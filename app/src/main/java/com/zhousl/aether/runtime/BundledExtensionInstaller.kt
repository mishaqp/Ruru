package com.zhousl.aether.runtime

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import java.security.MessageDigest
import java.util.Properties

internal enum class BundleInstallResult {
    Installed, Updated, Unchanged, PreservedLocalChanges,
}

/**
 * Upgrades only unchanged, identifiable bundled sources. User imports, edits,
 * extra files and dependency trees are never silently overwritten. Staging and
 * the recovery backup are outside the extension discovery directory.
 */
internal class BundledExtensionInstaller(
    private val extensionRoot: File,
    private val stateRoot: File,
) {
    fun install(
        name: String,
        legacyHashes: Map<String, String> = emptyMap(),
        writeBundle: (File) -> Unit,
    ): BundleInstallResult = synchronized(processLock) {
        require(name.matches(Regex("[A-Za-z0-9][A-Za-z0-9._-]*"))) { "Invalid bundle name." }
        check(extensionRoot.mkdirs() || extensionRoot.isDirectory)
        check(stateRoot.mkdirs() || stateRoot.isDirectory)
        RandomAccessFile(File(stateRoot, "install.lock"), "rw").use { lockFile ->
            lockFile.channel.lock().use {
                installLocked(name, legacyHashes, writeBundle)
            }
        }
    }

    private fun installLocked(
        name: String,
        legacyHashes: Map<String, String>,
        writeBundle: (File) -> Unit,
    ): BundleInstallResult {
        val target = File(extensionRoot, name)
        val stage = File(stateRoot, "$name.stage")
        val backup = File(stateRoot, "$name.backup")
        recover(target, stage, backup)
        deleteTree(stage)
        check(stage.mkdirs()) { "Unable to stage bundled extension $name." }
        try {
            // No writes to the installed package until the full asset copy and
            // verification succeeded. A disk-full error leaves the old tree intact.
            writeBundle(stage)
            val next = sourceHashes(stage)
            check("package.json" in next) { "Bundled extension $name has no package.json." }
            if (!exists(target)) {
                writeManifest(stage, next)
                check(stage.renameTo(target)) { "Unable to install bundled extension $name." }
                return BundleInstallResult.Installed
            }
            if (!target.isDirectory || Files.isSymbolicLink(target.toPath())) {
                return BundleInstallResult.PreservedLocalChanges
            }
            val manifest = File(target, manifestName)
            val previous = if (exists(manifest)) readManifest(target) else legacyHashes
            if (previous.isEmpty() || !matches(target, previous)) {
                return BundleInstallResult.PreservedLocalChanges
            }
            if (previous == next) {
                // Adopt an exact known legacy bundle for future upgrades.
                if (!exists(manifest)) writeManifest(target, next)
                return BundleInstallResult.Unchanged
            }
            if (!copyExtras(target, stage, previous.keys, next.keys)) {
                return BundleInstallResult.PreservedLocalChanges
            }
            writeManifest(stage, next)
            if (!matches(target, previous)) return BundleInstallResult.PreservedLocalChanges
            check(!exists(backup)) { "An unresolved bundled extension backup exists." }
            check(target.renameTo(backup)) { "Unable to back up bundled extension $name." }
            try {
                val dependencies = File(backup, "node_modules")
                if (exists(dependencies)) {
                    check(dependencies.renameTo(File(stage, "node_modules"))) {
                        "Unable to retain extension dependencies."
                    }
                }
                check(stage.renameTo(target)) { "Unable to activate bundled extension $name." }
            } catch (error: Exception) {
                // The same recovery path also handles process death between renames.
                recover(target, stage, backup)
                throw error
            }
            deleteTree(backup)
            return BundleInstallResult.Updated
        } finally {
            // Preserve the journal if recovery itself failed; it may contain the
            // only copy of the old dependency tree and must survive the next launch.
            if (exists(target) || !exists(backup)) deleteTree(stage)
        }
    }

    private fun recover(target: File, stage: File, backup: File) {
        if (!exists(backup)) return
        check(!Files.isSymbolicLink(backup.toPath())) { "Invalid bundle recovery directory." }
        if (!exists(target)) {
            val movedDependencies = File(stage, "node_modules")
            if (exists(movedDependencies) && !exists(File(backup, "node_modules"))) {
                check(movedDependencies.renameTo(File(backup, "node_modules"))) {
                    "Unable to recover extension dependencies."
                }
            }
            check(backup.renameTo(target)) { "Unable to recover the previous bundled extension." }
        } else {
            check(readManifest(target).isNotEmpty()) { "Unverified extension with pending recovery backup." }
            deleteTree(backup)
        }
    }

    private fun copyExtras(
        source: File,
        destination: File,
        previous: Set<String>,
        next: Set<String>,
        relative: String = "",
    ): Boolean {
        val directory = if (relative.isEmpty()) source else File(source, relative)
        for (entry in checkNotNull(directory.listFiles()) { "Unable to read bundled extension directory." }) {
            val path = if (relative.isEmpty()) entry.name else "$relative/${entry.name}"
            if (path == manifestName) continue
            // Never traverse a symlink supplied by an imported or edited package.
            if (Files.isSymbolicLink(entry.toPath())) return false
            if (path == "node_modules") continue // moved intact after the backup rename
            val output = File(destination, path)
            if (entry.isDirectory) {
                if (exists(output) && !output.isDirectory) return false
                if (!copyExtras(source, destination, previous, next, path)) return false
            } else if (path !in previous) {
                if (path in next || exists(output)) return false
                check(output.parentFile.mkdirs() || output.parentFile.isDirectory)
                entry.copyTo(output)
            }
        }
        return true
    }

    private fun matches(root: File, expected: Map<String, String>): Boolean =
        expected.all { (relative, digest) ->
            if (!validRelativePath(relative) || !digest.matches(Regex("[0-9a-f]{64}"))) {
                false
            } else {
                var cursor = root
                var safe = true
                for (segment in relative.split('/')) {
                    cursor = File(cursor, segment)
                    if (Files.isSymbolicLink(cursor.toPath())) safe = false
                }
                safe && cursor.isFile && sha256(cursor) == digest
            }
        }

    private fun readManifest(root: File): Map<String, String> {
        val file = File(root, manifestName)
        if (!file.isFile || Files.isSymbolicLink(file.toPath())) return emptyMap()
        return runCatching {
            val properties = Properties().apply { file.reader().use { load(it) } }
            properties.stringPropertyNames().associateWith { properties.getProperty(it) }
        }.getOrDefault(emptyMap())
    }

    private fun writeManifest(root: File, hashes: Map<String, String>) {
        val temporary = File(root, "$manifestName.tmp")
        val output = File(root, manifestName)
        check(!exists(temporary)) { "Bundle manifest staging path is already occupied." }
        val properties = Properties().apply { hashes.toSortedMap().forEach { (key, value) -> setProperty(key, value) } }
        temporary.writer().use { properties.store(it, "Ruru managed bundled source hashes") }
        check(temporary.renameTo(output)) { "Unable to record bundled extension provenance." }
    }

    companion object {
        private val processLock = Any()
        private const val manifestName = ".ruru-bundle.properties"
        private fun exists(file: File) = Files.exists(file.toPath(), LinkOption.NOFOLLOW_LINKS)
        private fun validRelativePath(path: String): Boolean = path.isNotBlank() &&
            '\\' !in path && path.split('/').all { it.isNotEmpty() && it != "." && it != ".." } &&
            path != manifestName && path != "node_modules" && !path.startsWith("node_modules/")

        internal fun sourceHashes(root: File): Map<String, String> {
            val hashes = sortedMapOf<String, String>()
            fun visit(directory: File, prefix: String) {
                check(!Files.isSymbolicLink(directory.toPath())) { "Symlink in bundled assets." }
                for (entry in checkNotNull(directory.listFiles()) { "Unable to read bundled extension directory." }) {
                    val relative = if (prefix.isEmpty()) entry.name else "$prefix/${entry.name}"
                    if (relative == manifestName || relative == "node_modules") continue
                    check(!Files.isSymbolicLink(entry.toPath())) { "Symlink in bundled assets." }
                    if (entry.isDirectory) visit(entry, relative)
                    else {
                        check(validRelativePath(relative) && entry.isFile) { "Invalid bundled asset path." }
                        hashes[relative] = sha256(entry)
                    }
                }
            }
            visit(root, "")
            return hashes
        }

        private fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buffer = ByteArray(16 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        }

        private fun deleteTree(file: File) {
            if (!exists(file)) return
            Files.walkFileTree(file.toPath(), object : SimpleFileVisitor<Path>() {
                override fun visitFile(path: Path, attrs: BasicFileAttributes): FileVisitResult {
                    Files.delete(path)
                    return FileVisitResult.CONTINUE
                }
                override fun postVisitDirectory(path: Path, error: IOException?): FileVisitResult {
                    if (error != null) throw error
                    Files.delete(path)
                    return FileVisitResult.CONTINUE
                }
            })
        }
    }
}
