package com.ailinkcat.mobile

import android.app.Application
import android.content.Context
import com.ailinkcat.mobile.i18n.LanguageManager

/** initializes the language manager synchronously in attachBaseContext (not onCreate),
 *  so the selection is ready before any activity attaches its base context */
class AlinkcatApplication : Application() {

    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        LanguageManager.get(this).initializeBlocking()
    }
}
