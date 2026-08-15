package com.ailinkcat.mobile.ui.render.layouts

/**
 * 设计基准分辨率：PC 端设计画布参考尺寸。
 * 自由布局控件若使用设计像素坐标（x/y/width/height），
 * 按 actual / DESIGN 等比缩放以适配不同手机屏幕。
 */
object DesignCanvas {
    const val DESIGN_WIDTH = 1280f
    const val DESIGN_HEIGHT = 720f
}
