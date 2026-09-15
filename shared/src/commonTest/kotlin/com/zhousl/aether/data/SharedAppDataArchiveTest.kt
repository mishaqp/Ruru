package com.zhousl.aether.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class SharedAppDataArchiveTest {
    @Test
    fun roundTripPreservesModernAndroidSettingsAndPayloads() {
        val sourceSettings = AppSettings(
            language = AppLanguage.Russian,
            themeMode = AppThemeMode.Dark,
            defaultLlmProviderConfigId = "cfg-main",
            llmInactivityReconnectTimeoutSeconds = 180,
            oldCommandHistoryRetentionHours = 72,
            defaultSelectedSkillIds = listOf("review", "workspace"),
            disabledPiExtensionIds = listOf("package:npm:example"),
            providerEnvironmentVariables = listOf(
                ProviderEnvironmentVariable(name = "OPENAI_ORG_ID", value = "org-123"),
            ),
            customHeaders = listOf(
                CustomHeader(name = "X-Trace", value = "abc"),
            ),
            alpinePackageProfiles = mapOf(
                "core" to PackageProfileState(installed = true, installedAtMillis = 42L),
            ),
        )
        val sourceSession = PersistedChatSession(
            id = "session-1",
            title = "Hello",
            preview = "Preview",
            hasCustomTitle = true,
            selectedSkillIds = listOf("review"),
            agentModeEnabled = true,
            chromeEnabled = true,
            selectedModelKey = "cfg-main::gpt-test",
            messages = listOf(
                PersistedChatMessage(
                    id = "assistant-1",
                    text = "result",
                    fromUser = false,
                    createdAtMillis = 123L,
                    providerPayloadJson = "{\"provider\":\"openai\"}",
                    responseBlocks = listOf(
                        SharedAssistantResponseBlock.Text(
                            id = "text-1",
                            text = "result",
                            isPending = false,
                        ),
                    ),
                ),
            ),
        )
        val providerConfigs = listOf(
            LlmProviderConfig(
                id = "cfg-main",
                name = "OpenAI",
                providerType = LlmProviderType.OpenAI,
                apiKey = "secret",
                baseUrl = "https://api.example.com/v1",
                modelId = "gpt-test",
            ),
        )

        val archive = encodeSharedAppDataArchive(
            settings = sourceSettings,
            sessions = listOf(sourceSession),
            currentSessionId = sourceSession.id,
            providerConfigs = providerConfigs,
        )
        val decoded = decodeSharedAppDataArchive(archive)

        assertEquals(sourceSettings.language, decoded.settings.language)
        assertEquals(sourceSettings.themeMode, decoded.settings.themeMode)
        assertEquals(sourceSettings.defaultLlmProviderConfigId, decoded.settings.defaultLlmProviderConfigId)
        assertEquals(sourceSettings.defaultSelectedSkillIds, decoded.settings.defaultSelectedSkillIds)
        assertEquals(sourceSettings.disabledPiExtensionIds, decoded.settings.disabledPiExtensionIds)
        assertEquals(sourceSettings.providerEnvironmentVariables, decoded.settings.providerEnvironmentVariables)
        assertEquals(sourceSettings.customHeaders, decoded.settings.customHeaders)
        assertEquals(42L, decoded.settings.alpinePackageProfiles.getValue("core").installedAtMillis)
        assertEquals(sourceSession, decoded.sessions.single())
        assertEquals(sourceSession.id, decoded.currentSessionId)
        assertEquals(providerConfigs.single().id, decoded.providerConfigs.single().id)
        assertEquals("secret", decoded.providerConfigs.single().apiKey)
    }

    @Test
    fun archiveCanRoundTripMinimalSettings() {
        val archive = encodeSharedAppDataArchive(
            settings = AppSettings(),
            sessions = emptyList(),
            currentSessionId = "draft",
            providerConfigs = emptyList(),
        )
        val decoded = decodeSharedAppDataArchive(archive)
        assertEquals(AppSettings().language, decoded.settings.language)
        assertEquals(AppSettings().themeMode, decoded.settings.themeMode)
        assertEquals("draft", decoded.currentSessionId)
    }

    @Test
    fun providerModelKeyHelpersKeepProviderConfigIdentity() {
        assertEquals("cfg::model", providerModelKey("cfg", "model"))
        assertEquals("cfg", providerConfigIdFromModelKey("cfg::model"))
        assertEquals("model", modelIdFromModelKey("cfg::model"))
        assertEquals("", providerConfigIdFromModelKey("model"))
        assertEquals("model", modelIdFromModelKey("model"))
    }

    @Test
    fun decodeKeepsSchemaDefaultsWhenFieldsAreMissing() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {},
              "sessions": [],
              "currentSessionId": "draft",
              "providerConfigs": []
            }
            """.trimIndent(),
        )
        assertEquals(AppSettings(), decoded.settings)
    }

    @Test
    fun appArchiveReportsExpectedShape() {
        val encoded = encodeSharedAppDataArchive(
            settings = AppSettings(),
            sessions = emptyList(),
            currentSessionId = "draft",
            providerConfigs = emptyList(),
        )
        val root = sharedJson.parseToJsonElement(encoded).jsonObject
        assertEquals(JsonPrimitive(2), root["schemaVersion"])
        assertEquals(JsonPrimitive("app"), root["exportType"])
        assertNotNull(root["settings"])
        assertNotNull(root["sessions"])
        assertNotNull(root["providerConfigs"])
    }

    @Test
    fun exportTypeConversationRoundTripsOneSession() {
        val session = PersistedChatSession(
            id = "session",
            title = "title",
            preview = "preview",
            hasCustomTitle = false,
        )
        val encoded = encodeSharedConversationArchive(session)
        val root = sharedJson.parseToJsonElement(encoded).jsonObject
        assertEquals(JsonPrimitive(2), root["schemaVersion"])
        assertEquals(JsonPrimitive("conversation"), root["exportType"])
        val decoded = decodeSharedConversationArchive(encoded)
        assertEquals(session, decoded)
    }

    @Test
    fun oldCommandHistoryRetentionIsClampedWhenDecoding() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {"oldCommandHistoryRetentionHours": 99999}
            }
            """.trimIndent(),
        )
        assertEquals(168, decoded.settings.oldCommandHistoryRetentionHours)
    }

    @Test
    fun providerEnvironmentVariableInvalidItemsAreDropped() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {
                "providerEnvironmentVariables": [
                  {"name":"A","value":"1"},
                  "invalid",
                  {"value":"missing-name"}
                ]
              }
            }
            """.trimIndent(),
        )
        assertEquals(listOf(ProviderEnvironmentVariable(name = "A", value = "1")), decoded.settings.providerEnvironmentVariables)
    }

    @Test
    fun headersWithoutNameAreIgnored() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {
                "customHeaders": [
                  {"name":"X-Test","value":"ok"},
                  {"value":"missing-name"}
                ]
              }
            }
            """.trimIndent(),
        )
        assertEquals(listOf(CustomHeader(name = "X-Test", value = "ok")), decoded.settings.customHeaders)
    }

    @Test
    fun malformedSettingsFieldFallsBackIndividuallyLikeAndroid() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {
                "piProviderId": "openai",
                "apiKey": "kept-secret",
                "modelId": "kept-model",
                "language": "zh-CN",
                "themeMode": "dark",
                "privacyPolicyAccepted": true,
                "llmInactivityReconnectTimeoutSeconds": {"invalid":true},
                "oldCommandHistoryRetentionHours": 999,
                "defaultSelectedSkillIds": ["review", 7, null, "review"],
                "providerEnvironmentVariables": [
                  {"name":"OPENAI_ORG_ID","value":"org"},
                  "invalid"
                ],
                "customHeaders": [
                  {"name":"X-Trace","value":"trace"},
                  {"value":"missing-name"}
                ],
                "alpinePackageProfiles": [
                  {"profileId":"core","installed":true,"installedAtMillis":123},
                  {"installed":true}
                ]
              }
            }
            """.trimIndent(),
        )

        val settings = decoded.settings
        assertEquals("openai", settings.piProviderId)
        assertEquals("kept-secret", settings.apiKey)
        assertEquals("kept-model", settings.modelId)
        assertEquals(AppLanguage.English, settings.language)
        assertEquals(AppThemeMode.Dark, settings.themeMode)
        assertTrue(settings.privacyPolicyAccepted)
        assertEquals(AppSettings().llmInactivityReconnectTimeoutSeconds, settings.llmInactivityReconnectTimeoutSeconds)
        assertEquals(168, settings.oldCommandHistoryRetentionHours)
        assertEquals(listOf("review", "7", "review"), settings.defaultSelectedSkillIds)
        assertEquals("OPENAI_ORG_ID", settings.providerEnvironmentVariables.single().name)
        assertEquals("X-Trace", settings.customHeaders.single().name)
        assertEquals(123L, settings.alpinePackageProfiles.getValue("core").installedAtMillis)
    }

    @Test
    fun malformedChatMessageCreatesAndroidRecoverySessionInsteadOfDroppingHistory() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "sessions": [{
                "id": "damaged",
                "title": "Damaged",
                "preview": "",
                "messages": [null]
              }]
            }
            """.trimIndent(),
        )
        assertEquals(1, decoded.sessions.size)
        assertTrue(decoded.sessions.single().id.startsWith("corrupt-chat-state-"))
        assertTrue(decoded.sessions.single().messages.single().providerPayloadJson.isNotBlank())
    }

    @Test
    fun currentSessionFallsBackToDraftWhenMissing() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "currentSessionId": "missing",
              "sessions": []
            }
            """.trimIndent(),
        )
        assertEquals("draft", decoded.currentSessionId)
    }

    @Test
    fun providerConfigKeepsKnownFieldsAndDropsUnknownFields() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "providerConfigs": [{
                "id":"cfg",
                "name":"Provider",
                "providerType":"openai",
                "apiKey":"secret",
                "unknown":"ignored"
              }]
            }
            """.trimIndent(),
        )
        val provider = decoded.providerConfigs.single()
        assertEquals("cfg", provider.id)
        assertEquals("Provider", provider.name)
        assertEquals("secret", provider.apiKey)
    }

    @Test
    fun disabledPiExtensionsArePreserved() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {
                "disabledPiExtensionIds": ["package:npm:test", "package:npm:test"]
              }
            }
            """.trimIndent(),
        )
        assertEquals(listOf("package:npm:test"), decoded.settings.disabledPiExtensionIds)
    }

    @Test
    fun nullValuesUseSchemaDefaults() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {
                "language": null,
                "themeMode": null
              }
            }
            """.trimIndent(),
        )
        assertEquals(AppSettings().language, decoded.settings.language)
        assertEquals(AppSettings().themeMode, decoded.settings.themeMode)
    }

    @Test
    fun unknownExportTypeFails() {
        val result = runCatching {
            decodeSharedAppDataArchive(
                """
                {
                  "schemaVersion": 2,
                  "exportType": "something-else"
                }
                """.trimIndent(),
            )
        }
        assertTrue(result.isFailure)
    }

    @Test
    fun providerConfigsRoundTripUnknownBuiltinModelId() {
        val provider = LlmProviderConfig(
            id = "cfg-custom-model",
            name = "OpenAI",
            providerType = LlmProviderType.OpenAI,
            apiKey = "secret",
            modelId = "future-model",
        )
        val encoded = encodeSharedAppDataArchive(
            settings = AppSettings(),
            sessions = emptyList(),
            currentSessionId = "draft",
            providerConfigs = listOf(provider),
        )
        val decoded = decodeSharedAppDataArchive(encoded)
        assertEquals("future-model", decoded.providerConfigs.single().modelId)
    }

    @Test
    fun primitiveSettingsValuesAreCoercedWhereSupported() {
        val decoded = decodeSharedAppDataArchive(
            """
            {
              "schemaVersion": 2,
              "exportType": "app",
              "settings": {
                "oldCommandHistoryRetentionHours": 12.7,
                "privacyPolicyAccepted": "true"
              }
            }
            """.trimIndent(),
        )
        assertEquals(12, decoded.settings.oldCommandHistoryRetentionHours)
        assertFalse(decoded.settings.privacyPolicyAccepted)
    }
}
