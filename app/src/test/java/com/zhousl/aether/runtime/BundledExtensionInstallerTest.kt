package com.zhousl.aether.runtime

import java.io.File
import java.nio.file.Files
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class BundledExtensionInstallerTest {
    @get:Rule val temporary = TemporaryFolder()
    private fun put(root: File, path: String, value: String) {
        File(root, path).apply { parentFile.mkdirs(); writeText(value) }
    }
    private fun bundle(root: File, version: String) {
        put(root, "package.json", "{\"name\":\"fixture\",\"version\":\"$version\"}")
        put(root, "src/index.ts", "export const version = '$version';")
    }

    @Test fun installsAndUpdatesManagedPackageWithoutLosingExtraFilesOrDependencies() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val installer = BundledExtensionInstaller(root, state)
        assertEquals(BundleInstallResult.Installed, installer.install("fixture") { bundle(it, "1") })
        val target = File(root, "fixture")
        put(target, "user-config.json", "my private settings")
        put(target, "node_modules/fixture/index.js", "cached dependency")
        assertEquals(BundleInstallResult.Updated, installer.install("fixture") { bundle(it, "2") })
        assertTrue(File(target, "src/index.ts").readText().contains("'2'"))
        assertEquals("my private settings", File(target, "user-config.json").readText())
        assertEquals("cached dependency", File(target, "node_modules/fixture/index.js").readText())
        assertEquals(BundleInstallResult.Unchanged, installer.install("fixture") { bundle(it, "2") })
    }

    @Test fun adoptsOnlyAnUnmodifiedKnownLegacyBundle() {
        val root = temporary.newFolder("extensions")
        val target = File(root, "fixture").apply { mkdirs() }
        bundle(target, "1")
        val baseline = BundledExtensionInstaller.sourceHashes(target)
        val installer = BundledExtensionInstaller(root, temporary.newFolder("state"))
        assertEquals(BundleInstallResult.Updated, installer.install("fixture", baseline) { bundle(it, "2") })
        assertTrue(File(target, "src/index.ts").readText().contains("'2'"))
    }

    @Test fun preservesEditedLegacyAndManagedPackages() {
        val root = temporary.newFolder("extensions")
        val target = File(root, "fixture").apply { mkdirs() }
        bundle(target, "1")
        val baseline = BundledExtensionInstaller.sourceHashes(target)
        put(target, "src/index.ts", "my edits")
        val installer = BundledExtensionInstaller(root, temporary.newFolder("state"))
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("fixture", baseline) { bundle(it, "2") })
        assertEquals("my edits", File(target, "src/index.ts").readText())
        assertEquals(BundleInstallResult.Installed, installer.install("managed") { bundle(it, "1") })
        put(File(root, "managed"), "src/index.ts", "managed edits")
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("managed") { bundle(it, "2") })
        assertEquals("managed edits", File(root, "managed/src/index.ts").readText())
    }

    @Test fun neverAdoptsUnknownImportsOrOverwritesNewFileCollisions() {
        val root = temporary.newFolder("extensions")
        val target = File(root, "fixture").apply { mkdirs() }
        bundle(target, "1")
        val installer = BundledExtensionInstaller(root, temporary.newFolder("state"))
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("fixture") { bundle(it, "2") })
        assertEquals(BundleInstallResult.Installed, installer.install("managed") { bundle(it, "1") })
        put(File(root, "managed"), "new.ts", "local extra")
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("managed") {
            bundle(it, "2"); put(it, "new.ts", "new bundled file")
        })
        assertEquals("local extra", File(root, "managed/new.ts").readText())
    }

    @Test fun failedCopyCannotLeaveAnIncompleteInstalledDirectory() {
        val root = temporary.newFolder("extensions")
        val installer = BundledExtensionInstaller(root, temporary.newFolder("state"))
        try {
            installer.install("fixture") { put(it, "package.json", "partial"); error("simulated full disk") }
            fail("Expected copy failure")
        } catch (expected: IllegalStateException) {
            assertEquals("simulated full disk", expected.message)
        }
        assertFalse(File(root, "fixture").exists())
        assertEquals(BundleInstallResult.Installed, installer.install("fixture") { bundle(it, "1") })
    }

    @Test fun failedUpgradeRetainsThePreviousWorkingPackage() {
        val root = temporary.newFolder("extensions")
        val installer = BundledExtensionInstaller(root, temporary.newFolder("state"))
        installer.install("fixture") { bundle(it, "1") }
        try {
            installer.install("fixture") { put(it, "package.json", "partial"); error("interrupted") }
            fail("Expected copy failure")
        } catch (_: IllegalStateException) { }
        assertTrue(File(root, "fixture/src/index.ts").readText().contains("'1'"))
        assertEquals(BundleInstallResult.Updated, installer.install("fixture") { bundle(it, "2") })
    }

    @Test fun recoversAnInterruptedDirectorySwapIncludingMovedDependencies() {
        val root = temporary.newFolder("extensions")
        val state = temporary.newFolder("state")
        val installer = BundledExtensionInstaller(root, state)
        installer.install("fixture") { bundle(it, "1") }
        put(File(root, "fixture"), "node_modules/cache.txt", "keep")
        assertTrue(File(root, "fixture").renameTo(File(state, "fixture.backup")))
        val stage = File(state, "fixture.stage").apply { mkdirs() }
        assertTrue(File(state, "fixture.backup/node_modules").renameTo(File(stage, "node_modules")))
        assertEquals(BundleInstallResult.Updated, installer.install("fixture") { bundle(it, "2") })
        assertEquals("keep", File(root, "fixture/node_modules/cache.txt").readText())
    }

    @Test fun doesNotFollowUserSymlinksOrAcceptTraversal() {
        val root = temporary.newFolder("extensions")
        val outside = temporary.newFolder("outside")
        val installer = BundledExtensionInstaller(root, temporary.newFolder("state"))
        installer.install("fixture") { bundle(it, "1") }
        Files.createSymbolicLink(File(root, "fixture/user-link").toPath(), outside.toPath())
        assertEquals(BundleInstallResult.PreservedLocalChanges, installer.install("fixture") { bundle(it, "2") })
        assertTrue(outside.listFiles().orEmpty().isEmpty())
        try {
            installer.install("../outside") { bundle(it, "2") }
            fail("Traversal accepted")
        } catch (_: IllegalArgumentException) { }
    }
}
