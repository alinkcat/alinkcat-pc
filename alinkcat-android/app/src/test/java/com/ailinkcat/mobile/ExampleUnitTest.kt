package com.ailinkcat.mobile

import com.ailinkcat.mobile.ui.config.applyScanContent
import org.junit.Assert.assertEquals
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun addition_isCorrect() {
        assertEquals(4, 2 + 2)
    }

    @Test
    fun scanContent_parsesUrl() {
        val result = applyScanContent("ws://192.168.1.100:9527?pairCode=1234")
        assertEquals(Triple("192.168.1.100", "9527", "1234"), result)
    }

    @Test
    fun scanContent_parsesJson() {
        val result = applyScanContent("""{"ip":"10.0.0.8","port":"8080","pairCode":"5678"}""")
        assertEquals(Triple("10.0.0.8", "8080", "5678"), result)
    }

    @Test
    fun scanContent_parsesPlainText() {
        val result = applyScanContent("192.168.1.100:9527:4321")
        assertEquals(Triple("192.168.1.100", "9527", "4321"), result)
    }

    @Test
    fun scanContent_rejectsInvalid() {
        assertEquals(null, applyScanContent("no-ip-here"))
    }
}
