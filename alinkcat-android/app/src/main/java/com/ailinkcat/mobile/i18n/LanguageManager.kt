package com.ailinkcat.mobile.i18n

import android.content.Context
import android.content.res.Configuration
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale

/** language choice: system default / native (en/zh) / dynamic language pack */
sealed class LanguageSelection {
    object SystemDefault : LanguageSelection()
    /** native resource language (en/zh) */
    data class Native(val code: String) : LanguageSelection()
    /** dynamic language pack (builtin assets or imported to filesDir) */
    data class Dynamic(val code: String) : LanguageSelection()
}

/** one row in the language picker */
data class LanguageOption(
    val selection: LanguageSelection,
    /** display name in its own language */
    val label: String,
    /** builtin dynamic pack shipped in the apk (assets/langpacks/) */
    val builtin: Boolean,
    /** user-imported (filesDir/langpacks/), can be deleted/exported */
    val imported: Boolean
)

/** registered pack entry in filesDir/langpacks/index.json */
data class InstalledPack(
    val code: String,
    val label: String,
    val keyCount: Int,
    val importedAt: Long,
    /** imported = user import; builtin = user-area copy of a builtin pack (after overwrite update) */
    val source: String
)

/**
 * app-level language manager singleton (docs/多语言与语言包协议.md §1.5).
 * native en/zh inject a locale in attachBaseContext and use android resources; dynamic packs
 * force an en locale with a resources wrapper doing lookups (missing keys fall back to english).
 * first launch is strictly english. persisted in SharedPreferences ilinkcat_prefs / app_language
 */
class LanguageManager private constructor(private val appContext: Context) {

    companion object {
        @Volatile private var instance: LanguageManager? = null

        fun get(context: Context): LanguageManager {
            return instance ?: synchronized(this) {
                instance ?: LanguageManager(
                    // getApplicationContext() can be null during attachBaseContext (application
                    // not fully bound yet); the passed context is already valid, use it directly
                    context.applicationContext ?: context
                ).also { instance = it }
            }
        }

        private const val LANG_DIR = "langpacks"
        private const val INDEX_FILE = "index.json"
        private const val PREFS_NAME = "ilinkcat_prefs"
        private const val KEY_LANGUAGE = "app_language"
    }

    // state

    private val _currentSelection = MutableStateFlow<LanguageSelection?>(null)
    /** null only before initializeBlocking */
    val currentSelection: StateFlow<LanguageSelection?> = _currentSelection.asStateFlow()

    private val _activePack = MutableStateFlow<LanguagePack?>(null)
    /** active dynamic pack, only set for dynamic languages */
    val activePack: StateFlow<LanguagePack?> = _activePack.asStateFlow()

    private val _recreateTick = MutableStateFlow(0)
    /** bumped on language switch, activities recreate on it */
    val recreateTick: StateFlow<Int> = _recreateTick.asStateFlow()

    @Volatile private var initialized = false

    private val prefs get() = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // init

    /** called synchronously from Application.attachBaseContext: restores the persisted
     *  selection and loads the dynamic pack */
    fun initializeBlocking() {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            applySelection(decodeSelection(storedSelection()), persist = false)
            initialized = true
        }
    }

    private fun storedSelection(): String? = prefs.getString(KEY_LANGUAGE, null)

    /** persisted form: system / en / zh / pack:ja-JP */
    internal fun encodeSelection(sel: LanguageSelection): String = when (sel) {
        is LanguageSelection.SystemDefault -> "system"
        is LanguageSelection.Native -> sel.code
        is LanguageSelection.Dynamic -> "pack:${sel.code}"
    }

    /** null/empty (first launch) = strictly english */
    internal fun decodeSelection(stored: String?): LanguageSelection = when (stored) {
        null, "", "en" -> LanguageSelection.Native("en")
        "system" -> LanguageSelection.SystemDefault
        "zh" -> LanguageSelection.Native("zh")
        else -> {
            if (stored.startsWith("pack:") && stored.length > 5) {
                LanguageSelection.Dynamic(stored.substring(5))
            } else {
                LanguageSelection.Native("en")
            }
        }
    }

    // selection & activation

    /** apply + persist + broadcast recreate */
    suspend fun select(selection: LanguageSelection) = withContext(Dispatchers.IO) {
        applySelection(selection, persist = true)
        _recreateTick.value += 1
    }

    /** a missing dynamic pack falls back to system default and persists, so we don't retry every launch */
    private fun applySelection(selection: LanguageSelection, persist: Boolean) {
        var effective = selection
        if (selection is LanguageSelection.Dynamic) {
            val pack = loadPackBlocking(selection.code)
            if (pack != null) {
                _activePack.value = pack
            } else {
                // pack gone (cleaned up/deleted): fall back to system default
                effective = LanguageSelection.SystemDefault
                _activePack.value = null
            }
        } else {
            _activePack.value = null
        }
        _currentSelection.value = effective
        if (persist) {
            prefs.edit().putString(KEY_LANGUAGE, encodeSelection(effective)).apply()
        } else if (effective != decodeSelection(storedSelection())) {
            // pack went missing during init: fix the stored value so we don't retry next launch
            prefs.edit().putString(KEY_LANGUAGE, encodeSelection(effective)).apply()
        }
    }

    /** user-area file first, then assets builtin; installed packs trust the validation done at install */
    private fun loadPackBlocking(code: String): LanguagePack? {
        // whitelist the code, guards against path traversal
        if (!code.matches(Regex("[A-Za-z0-9_-]{2,20}"))) return null
        return try {
            val userFile = File(packDir(), "$code.json")
            val text = if (userFile.exists()) {
                userFile.readText()
            } else {
                appContext.assets.open("$LANG_DIR/$code.json").bufferedReader().use { it.readText() }
            }
            LanguagePackParser.loadInstalled(text)
        } catch (e: Exception) {
            null
        }
    }

    // activity injection

    /** called from Activity.attachBaseContext. SystemDefault passes base through; native
     *  forces the locale; dynamic forces en (deterministic fallback) + PackResources lookup,
     *  rtl packs flip the layout direction */
    fun attachBaseContext(base: Context): Context {
        return when (val sel = _currentSelection.value) {
            null, is LanguageSelection.Native -> {
                val locale = if (sel == null || (sel as LanguageSelection.Native).code == "en") {
                    Locale.ENGLISH
                } else {
                    Locale.forLanguageTag((sel as LanguageSelection.Native).code)
                }
                forceLocale(base, locale, rtl = false)
            }
            is LanguageSelection.SystemDefault -> base
            is LanguageSelection.Dynamic -> {
                val pack = _activePack.value
                var ctx = forceLocale(base, Locale.ENGLISH, rtl = pack?.rtl == true)
                if (pack != null) {
                    ctx = LanguagePackContextWrapper.wrap(ctx, pack)
                }
                ctx
            }
        }
    }

    private fun forceLocale(base: Context, locale: Locale, rtl: Boolean): Context {
        val config = Configuration(base.resources.configuration)
        config.setLocale(locale)
        if (rtl) {
            // setLayoutDirection resolves direction from the locale, so pass an rtl locale (ar)
            config.setLayoutDirection(Locale.forLanguageTag("ar"))
        }
        return base.createConfigurationContext(config)
    }

    // lookup entry points for non-compose code

    /** dynamic pack first, fallback matches the current selection */
    fun getString(resId: Int): String {
        translate(resId)?.let { return it }
        return resourceContext().getString(resId)
    }

    fun getString(resId: Int, vararg formatArgs: Any): String {
        val ctx = resourceContext()
        val raw = translate(resId) ?: ctx.getString(resId)
        return String.format(ctx.resources.configuration.locales[0], raw, *formatArgs)
    }

    private fun translate(resId: Int): String? {
        val pack = _activePack.value ?: return null
        val name = entryNameFor(resId) ?: return null
        return pack.resources[name]
    }

    private fun entryNameFor(resId: Int): String? = try {
        appContext.resources.getResourceEntryName(resId)
    } catch (e: Exception) {
        null
    }

    /** resource context matching the current selection, for fallback reads */
    private fun resourceContext(): Context = when (val sel = _currentSelection.value) {
        is LanguageSelection.SystemDefault -> appContext
        is LanguageSelection.Native -> if (sel.code == "zh") zhResContext() else enResContext()
        // dynamic or uninitialized: english fallback
        is LanguageSelection.Dynamic, null -> enResContext()
    }

    @Volatile private var cachedEnContext: Context? = null
    @Volatile private var cachedZhContext: Context? = null

    private fun enResContext(): Context = cachedEnContext ?: appContext
        .createConfigurationContext(Configuration().apply { setLocale(Locale.ENGLISH) })
        .also { cachedEnContext = it }

    private fun zhResContext(): Context = cachedZhContext ?: appContext
        .createConfigurationContext(Configuration().apply { setLocale(Locale.SIMPLIFIED_CHINESE) })
        .also { cachedZhContext = it }

    // language options

    /** picker data: system/en/zh + builtin dynamic packs + imported ones, computed fresh each call */
    suspend fun languageOptions(): List<LanguageOption> = withContext(Dispatchers.IO) {
        val result = mutableListOf(
            LanguageOption(LanguageSelection.SystemDefault, "System Default", builtin = false, imported = false),
            LanguageOption(LanguageSelection.Native("en"), "English", builtin = false, imported = false),
            LanguageOption(LanguageSelection.Native("zh"), "简体中文", builtin = false, imported = false)
        )
        builtinPackCodes().forEach { code ->
            val pack = loadPackBlocking(code) ?: return@forEach
            result.add(
                LanguageOption(
                    selection = LanguageSelection.Dynamic(pack.code),
                    label = pack.label,
                    builtin = true,
                    imported = false
                )
            )
        }
        // imported packs still on disk
        installedPacks().forEach { ip ->
            if (result.none { it.selection is LanguageSelection.Dynamic && (it.selection as LanguageSelection.Dynamic).code == ip.code }) {
                result.add(
                    LanguageOption(
                        selection = LanguageSelection.Dynamic(ip.code),
                        label = ip.label,
                        builtin = false,
                        imported = true
                    )
                )
            }
        }
        result
    }

    private fun builtinPackCodes(): List<String> = try {
        (appContext.assets.list(LANG_DIR) ?: emptyArray())
            .filter { it.endsWith(".json") }
            .map { it.removeSuffix(".json") }
            .sorted()
    } catch (e: Exception) {
        emptyList()
    }

    suspend fun installedPacks(): List<InstalledPack> = withContext(Dispatchers.IO) {
        val indexFile = File(packDir(), INDEX_FILE)
        if (!indexFile.exists()) return@withContext emptyList()
        try {
            val arr = JSONArray(indexFile.readText())
            val list = mutableListOf<InstalledPack>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val code = o.optString("code")
                if (code.isBlank()) continue
                if (!File(packDir(), "$code.json").exists()) continue
                list.add(
                    InstalledPack(
                        code = code,
                        label = o.optString("label").ifBlank { code },
                        keyCount = o.optInt("keyCount", 0),
                        importedAt = o.optLong("importedAt", 0L),
                        source = o.optString("source", "imported")
                    )
                )
            }
            list.sortedBy { it.code }
        } catch (e: Exception) {
            emptyList()
        }
    }

    // english baseline (for validation)

    @Volatile private var cachedBaseline: Map<String, String>? = null
    private val baselineMutex = Mutex()

    /** strings.xml name -> english value via R.string reflection, lazily loaded */
    suspend fun englishBaseline(): Map<String, String> {
        cachedBaseline?.let { return it }
        return baselineMutex.withLock {
            cachedBaseline ?: withContext(Dispatchers.IO) {
                val ctx = enResContext()
                val map = mutableMapOf<String, String>()
                for (field in com.ailinkcat.mobile.R.string::class.java.fields) {
                    val id = field.get(null) as Int
                    try {
                        map[field.name] = ctx.getString(id)
                    } catch (e: Exception) {
                    }
                }
                map
            }.also { cachedBaseline = it }
        }
    }

    // import / export / delete

    /** first step after an import or url download; on Valid the UI shows a coverage
     *  confirm dialog before calling [install] */
    suspend fun validate(jsonText: String): PackValidation = withContext(Dispatchers.IO) {
        LanguagePackParser.parse(jsonText, englishBaseline())
    }

    /** writes the file + index entry; takes effect immediately when overwriting the current language */
    suspend fun install(pack: LanguagePack, jsonText: String) = withContext(Dispatchers.IO) {
        val dir = packDir()
        File(dir, "${pack.code}.json").writeText(jsonText)

        val list = installedPacks().toMutableList()
        val wasCurrent = (_currentSelection.value as? LanguageSelection.Dynamic)?.code == pack.code
        list.removeAll { it.code == pack.code }
        list.add(
            InstalledPack(
                code = pack.code,
                label = pack.label,
                keyCount = pack.resources.size,
                importedAt = System.currentTimeMillis(),
                source = "imported"
            )
        )
        writeIndex(list)

        // overwrote the current language's pack, reload
        if (wasCurrent) {
            applySelection(LanguageSelection.Dynamic(pack.code), persist = false)
        }
    }

    /** falls back to system default when deleting the active pack with no assets copy */
    suspend fun deletePack(code: String) = withContext(Dispatchers.IO) {
        File(packDir(), "$code.json").delete()
        val list = installedPacks().toMutableList()
        list.removeAll { it.code == code }
        writeIndex(list)

        val cur = _currentSelection.value
        if (cur is LanguageSelection.Dynamic && cur.code == code) {
            if (loadPackBlocking(code) != null) {
                // assets copy still exists, reload from it
                applySelection(cur, persist = false)
            } else {
                applySelection(LanguageSelection.SystemDefault, persist = true)
                _recreateTick.value += 1
            }
        }
    }

    /** english template (all keys + english values) for translators */
    suspend fun exportTemplate(): String = withContext(Dispatchers.IO) {
        val baseline = englishBaseline()
        val resources = JSONObject()
        baseline.keys.sorted().forEach { key ->
            resources.put(key, baseline.getValue(key))
        }
        JSONObject()
            .put("code", "xx-XX")
            .put("label", "Language Name")
            .put("platform", "android")
            .put("version", LanguagePackParser.SUPPORTED_VERSION)
            .put("keyCount", baseline.size)
            .put("resources", resources)
            .toString(2)
    }

    /** raw pack text, user-area file first then assets */
    suspend fun exportPackText(code: String): String? = withContext(Dispatchers.IO) {
        if (!code.matches(Regex("[A-Za-z0-9_-]{2,20}"))) return@withContext null
        val userFile = File(packDir(), "$code.json")
        if (userFile.exists()) {
            userFile.readText()
        } else {
            try {
                appContext.assets.open("$LANG_DIR/$code.json").bufferedReader().use { it.readText() }
            } catch (e: Exception) {
                null
            }
        }
    }

    // storage

    private fun packDir(): File = File(appContext.filesDir, LANG_DIR).apply { mkdirs() }

    private fun writeIndex(list: List<InstalledPack>) {
        val arr = JSONArray()
        list.forEach {
            arr.put(
                JSONObject()
                    .put("code", it.code)
                    .put("label", it.label)
                    .put("keyCount", it.keyCount)
                    .put("importedAt", it.importedAt)
                    .put("source", it.source)
            )
        }
        File(packDir(), INDEX_FILE).writeText(arr.toString())
    }
}
