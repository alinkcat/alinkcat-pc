package com.ailinkcat.mobile.data

import com.ailinkcat.mobile.BuildConfig

/** backend base url, no auth involved, just cloud endpoints like weather.
 *  debug = local test server (override with API_HOST env var), release = cloud. */
object AuthApi {
    // single source of truth for the base url, everything else references this
    val BASE_URL: String = if (BuildConfig.DEBUG) {
        System.getenv("API_HOST")?.let { "http://$it:8080" } ?: "http://127.0.0.1:8080"
    } else {
        "https://api.pynen.com"
    }
}
