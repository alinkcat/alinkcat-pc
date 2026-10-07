package com.ailinkcat.mobile.i18n

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Resources
import java.util.concurrent.ConcurrentHashMap

/** resources interception for dynamic language packs (docs/多语言与语言包协议.md §1.5).
 *  once wrapped, every string read under the activity goes through [PackResources],
 *  missing keys fall back to the original (english) resources. only strings are
 *  intercepted, everything else passes through */
object LanguagePackContextWrapper {

    fun wrap(base: Context, pack: LanguagePack): Context {
        val packResources = PackResources(base.resources, pack)
        return object : ContextWrapper(base) {
            override fun getResources(): Resources = packResources
        }
    }
}

/** overrides the getString/getText family; entry name lookups are cached by resId */
class PackResources(
    delegate: Resources,
    private val pack: LanguagePack
) : Resources(delegate.assets, delegate.displayMetrics, delegate.configuration) {

    private val delegate = delegate

    companion object {
        private val ENTRY_NAME_CACHE = ConcurrentHashMap<Int, String>()

        // Resources construction triggers strict-mode warnings on some ROMs
        private val INIT_LOCK = Any()
    }

    init {
        synchronized(INIT_LOCK) {
        }
    }

    // getString / getText interception

    override fun getString(id: Int): String = translate(id) ?: delegate.getString(id)

    override fun getString(id: Int, vararg formatArgs: Any?): String {
        val raw = translate(id) ?: delegate.getString(id)
        return String.format(configuration.locales[0], raw, *formatArgs)
    }

    override fun getText(id: Int): CharSequence = translate(id) ?: delegate.getText(id)

    override fun getText(id: Int, def: CharSequence?): CharSequence =
        translate(id) ?: delegate.getText(id, def)

    // plurals: v1 has none, pass through

    override fun getQuantityString(id: Int, quantity: Int): String =
        delegate.getQuantityString(id, quantity)

    override fun getQuantityString(id: Int, quantity: Int, vararg formatArgs: Any?): String =
        delegate.getQuantityString(id, quantity, *formatArgs)

    override fun getQuantityText(id: Int, quantity: Int): CharSequence =
        delegate.getQuantityText(id, quantity)

    // everything else passes through

    override fun getIdentifier(name: String, defType: String, defPackage: String): Int =
        delegate.getIdentifier(name, defType, defPackage)

    override fun getResourceEntryName(id: Int): String = delegate.getResourceEntryName(id)

    override fun getResourceName(id: Int): String = delegate.getResourceName(id)

    // lookup core

    /** entry name -> translation, null on miss (caller falls back to english) */
    private fun translate(id: Int): String? {
        val entryName = ENTRY_NAME_CACHE.getOrPut(id) { entryNameOrEmpty(id) }
        if (entryName.isEmpty()) return null
        return pack.resources[entryName]
    }

    private fun entryNameOrEmpty(id: Int): String = try {
        delegate.getResourceEntryName(id) ?: ""
    } catch (e: Exception) {
        ""
    }
}
