package com.ailinkcat.mobile.data

import com.ailinkcat.mobile.BuildConfig

/**
 * 后端服务基础地址。
 * 无登录概念，仅提供天气等云端接口域名。
 * debug=本地测试服务器（环境变量 API_HOST 覆盖，缺省本机），release=云端。
 */
object AuthApi {
    /** 服务端基础地址唯一维护处（debug=局域网 / release=云端），其他模块统一引用。 */
    val BASE_URL: String = if (BuildConfig.DEBUG) {
        System.getenv("API_HOST")?.let { "http://$it:8080" } ?: "http://127.0.0.1:8080"
    } else {
        "https://top.atqx.cn"
    }
}
