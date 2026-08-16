package com.ailinkcat.mobile.ui.render

/**
 * 数据源映射：主题包中的 dataSource 名称 -> 实时数据键。
 * 与 PC 端 monitor.data 推送的字段对应：
 *   cpu / memory / disk / uptime / network.upload / network.download
 */
object DataSourceResolver {

    val MAP: Map<String, String> = mapOf(
        "system.cpu.usage" to "cpu",
        "system.memory.usage" to "memory",
        "system.disk.usage" to "disk",
        "system.network.upload" to "network.upload",
        "system.network.download" to "network.download",
        "system.uptime" to "uptime",
        "system.battery.level" to "battery",
        "system.battery.temperature" to "battery.temperature"
    )

    /** 订阅时使用的源列表。 */
    val SUBSCRIBE_SOURCES: List<String> =
        listOf("cpu", "memory", "network", "disk", "uptime", "battery", "battery.temperature")

    /** 内部键（用于订阅）。 */
    val INTERNAL_KEYS: Set<String> = MAP.values.toSet()

    fun resolve(dataSource: String): String = MAP[dataSource] ?: dataSource
}
