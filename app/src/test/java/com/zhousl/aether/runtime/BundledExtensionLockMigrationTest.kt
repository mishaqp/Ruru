package com.zhousl.aether.runtime

import java.io.File
import java.security.MessageDigest
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class BundledExtensionLockMigrationTest {
    @get:Rule val temporary = TemporaryFolder()
    private fun put(root: File, path: String, text: String) {
        File(root, path).apply { checkNotNull(parentFile).mkdirs(); writeText(text) }
    }
    private fun bundle(root: File, version: String, lock: String? = null) {
        put(root, "package.json", "{\"name\":\"fixture\",\"version\":\"$version\"}")
        put(root, "index.ts", "export const version = '$version';")
        if (lock != null) put(root, "package-lock.json", lock)
    }
    private fun backups(state: File) = state.listFiles().orEmpty().filter {
        it.name.startsWith("fixture.npm-lock-") && it.name.endsWith(".json")
    }

    @Test fun generatedLockDoesNotBlockKnownLegacyUpgradeAndIsBackedUpByteForByte() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val target = File(root, "fixture").apply { mkdirs() }
        bundle(target, "1")
        val baseline = BundledExtensionInstaller.sourceHashes(target)
        val oldLock = "{\"name\":\"fixture\",\"lockfileVersion\":3,\"packages\":{}}\n"
        put(target, "package-lock.json", oldLock)
        put(target, "node_modules/existing.txt", "keep dependency tree")
        put(target, "user-config.json", "keep settings")
        val installer = BundledExtensionInstaller(root, state)
        assertEquals(BundleInstallResult.Updated, installer.install("fixture", baseline) {
            bundle(it, "2", "new reviewed lockfile")
        })
        assertEquals("new reviewed lockfile", File(target, "package-lock.json").readText())
        assertEquals("keep settings", File(target, "user-config.json").readText())
        assertEquals("keep dependency tree", File(target, "node_modules/existing.txt").readText())
        assertTrue(File(target, "index.ts").readText().contains("'2'"))
        assertEquals(1, backups(state).size)
        assertArrayEquals(oldLock.toByteArray(), backups(state).single().readBytes())
    }

    @Test fun generatedLockIsAlsoAdoptedForAnAlreadyManagedBundle() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val installer = BundledExtensionInstaller(root, state)
        installer.install("fixture") { bundle(it, "1") }
        put(File(root, "fixture"), "package-lock.json", "npm generated local lock")
        assertEquals(BundleInstallResult.Updated, installer.install("fixture") {
            bundle(it, "2", "reviewed bundled lock")
        })
        assertEquals("npm generated local lock", backups(state).single().readText())
        assertEquals(BundleInstallResult.Unchanged, installer.install("fixture") {
            bundle(it, "2", "reviewed bundled lock")
        })
        assertEquals(1, backups(state).size)
    }

    @Test fun editedSourcesAreStillPreservedWithoutMigratingTheirLocalLock() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val target = File(root, "fixture").apply { mkdirs() }
        bundle(target, "1")
        val baseline = BundledExtensionInstaller.sourceHashes(target)
        put(target, "package-lock.json", "local lock")
        put(target, "index.ts", "user source edits")
        val installer = BundledExtensionInstaller(root, state)
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("fixture", baseline) {
            bundle(it, "2", "bundled lock")
        })
        assertEquals("local lock", File(target, "package-lock.json").readText())
        assertEquals("user source edits", File(target, "index.ts").readText())
        assertTrue(backups(state).isEmpty())
    }

    @Test fun anEditedPreviouslyManagedLockIsNeverReplaced() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val installer = BundledExtensionInstaller(root, state)
        installer.install("fixture") { bundle(it, "1", "original managed lock") }
        val target = File(root, "fixture")
        put(target, "package-lock.json", "user modified managed lock")
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("fixture") {
            bundle(it, "2", "new managed lock")
        })
        assertEquals("user modified managed lock", File(target, "package-lock.json").readText())
        assertTrue(backups(state).isEmpty())
    }

    @Test fun aConflictingBackupStopsTheUpgradeWithoutChangingInstalledData() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val target = File(root, "fixture").apply { mkdirs() }
        bundle(target, "1")
        val baseline = BundledExtensionInstaller.sourceHashes(target)
        val oldLock = "keep this lock exactly"
        put(target, "package-lock.json", oldLock)
        val digest = MessageDigest.getInstance("SHA-256").digest(oldLock.toByteArray())
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
        val archive = File(state, "fixture.npm-lock-$digest.json")
        archive.writeText("different existing backup")
        val installer = BundledExtensionInstaller(root, state)
        try {
            installer.install("fixture", baseline) { bundle(it, "2", "new lock") }
            fail("An invalid existing backup must not be overwritten")
        } catch (expected: IllegalStateException) {
            assertTrue(expected.message.orEmpty().contains("archived local npm lock"))
        }
        assertEquals(oldLock, File(target, "package-lock.json").readText())
        assertTrue(File(target, "index.ts").readText().contains("'1'"))
        assertEquals("different existing backup", archive.readText())
        assertFalse(File(state, "fixture.stage").exists())
    }
}
