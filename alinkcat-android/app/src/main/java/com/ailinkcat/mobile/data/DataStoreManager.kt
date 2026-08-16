package com.ailinkcat.mobile.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.ailinkcat.mobile.data.model.StoredConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "ailinkcat_config")

/**
 * 本地配置持久化：使用 DataStore 保存 IP、端口、配对码及上次连接记录。
 */
class DataStoreManager(private val context: Context) {

    private object Keys {
        val IP = stringPreferencesKey("ip")
        val PORT = stringPreferencesKey("port")
        val PAIR_CODE = stringPreferencesKey("pair_code")
        val DEVICE_NAME = stringPreferencesKey("device_name")
        val LAST_IP = stringPreferencesKey("last_connected_ip")
        val LAST_PORT = stringPreferencesKey("last_connected_port")
    }

    val config: Flow<StoredConfig> = context.dataStore.data.map { prefs ->
        StoredConfig(
            ip = prefs[Keys.IP] ?: "192.168.1.100",
            port = prefs[Keys.PORT] ?: "9527",
            pairCode = prefs[Keys.PAIR_CODE] ?: "",
            deviceName = prefs[Keys.DEVICE_NAME] ?: "My Android",
            lastConnectedIp = prefs[Keys.LAST_IP] ?: "",
            lastConnectedPort = prefs[Keys.LAST_PORT] ?: ""
        )
    }

    suspend fun saveConnection(ip: String, port: String, pairCode: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.IP] = ip
            prefs[Keys.PORT] = port
            prefs[Keys.PAIR_CODE] = pairCode
        }
    }

    suspend fun saveLastConnected(ip: String, port: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.LAST_IP] = ip
            prefs[Keys.LAST_PORT] = port
        }
    }

    suspend fun saveDeviceName(name: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.DEVICE_NAME] = name
        }
    }

    suspend fun clearPairingCode() {
        context.dataStore.edit { prefs ->
            prefs.remove(Keys.PAIR_CODE)
        }
    }
}
