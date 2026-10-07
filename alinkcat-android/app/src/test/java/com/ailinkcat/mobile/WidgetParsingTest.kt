package com.ailinkcat.mobile

import com.ailinkcat.mobile.domain.models.BatteryWidget
import com.ailinkcat.mobile.domain.models.CardWidget
import com.ailinkcat.mobile.domain.models.QuickActionWidget
import com.ailinkcat.mobile.domain.models.Widget
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** widget json parsing tests, unknown types degrade to null */
class WidgetParsingTest {

    @Test
    fun `parse battery widget`() {
        val json = JSONObject("""
            {
                "id": "battery_1",
                "type": "battery",
                "label": "Battery",
                "batteryStyle": "bar",
                "showLevel": true,
                "showCharging": true,
                "showTemp": false,
                "barColor": "#4CAF50",
                "lowColor": "#F44336",
                "lowThreshold": 20,
                "dataSource": "system.battery.level"
            }
        """)
        val widget = Widget.fromJson(json)
        assertNotNull(widget)
        assertTrue(widget is BatteryWidget)
        widget as BatteryWidget
        assertEquals("battery_1", widget.id)
        assertEquals("bar", widget.batteryStyle)
        assertEquals(true, widget.showLevel)
        assertEquals(false, widget.showTemp)
    }

    @Test
    fun `parse card widget`() {
        val json = JSONObject("""
            {
                "id": "card_1",
                "type": "card",
                "label": "Info Card",
                "cardTitle": "System Status",
                "cardDesc": "All systems operational",
                "cardImage": null,
                "cardImagePosition": "top",
                "cardTags": ["stable", "online"],
                "cardFooter": "Updated just now"
            }
        """)
        val widget = Widget.fromJson(json)
        assertNotNull(widget)
        assertTrue(widget is CardWidget)
        widget as CardWidget
        assertEquals("card_1", widget.id)
        assertEquals("System Status", widget.cardTitle)
        assertEquals(listOf("stable", "online"), widget.cardTags)
    }

    @Test
    fun `parse quick-action widget`() {
        val json = JSONObject("""
            {
                "id": "qa_1",
                "type": "quick-action",
                "columns": 2,
                "rows": 2,
                "cells": [
                    {
                        "type": "launcher",
                        "name": "Calculator",
                        "path": "calc.exe"
                    },
                    {
                        "type": "snippet",
                        "title": "Greetings",
                        "snippets": [
                            {"id": "s1", "label": "Hello", "content": "Hello World"},
                            {"id": "s2", "label": "Hi", "content": "Hi there"}
                        ]
                    }
                ]
            }
        """)
        val widget = Widget.fromJson(json)
        assertNotNull(widget)
        assertTrue(widget is QuickActionWidget)
        widget as QuickActionWidget
        assertEquals("qa_1", widget.id)
        assertEquals(2, widget.columns)
        assertEquals(2, widget.rows)
        assertEquals(2, widget.cells.size)
        assertEquals("launcher", widget.cells[0].type)
        assertEquals("Calculator", widget.cells[0].name)
        assertEquals("snippet", widget.cells[1].type)
        assertEquals(2, widget.cells[1].snippets.size)
    }

    @Test
    fun `unknown type returns null without crash`() {
        val json = JSONObject("""
            {
                "id": "unknown_1",
                "type": "non_existent_type_xyz",
                "label": "Unknown"
            }
        """)
        val widget = Widget.fromJson(json)
        assertNull(widget)
    }

    @Test
    fun `null json returns null`() {
        val widget = Widget.fromJson(null)
        assertNull(widget)
    }

    @Test
    fun `malformed json returns null`() {
        val json = JSONObject("""{"id": "bad"}""")
        val widget = Widget.fromJson(json)
        assertNull(widget)
    }

    @Test
    fun `parse battery widget with minimal fields`() {
        val json = JSONObject("""
            {
                "id": "battery_min",
                "type": "battery"
            }
        """)
        val widget = Widget.fromJson(json)
        assertNotNull(widget)
        assertTrue(widget is BatteryWidget)
        widget as BatteryWidget
        assertEquals("battery_min", widget.id)
        assertEquals("Battery", widget.label)
        assertEquals(true, widget.showLevel)
        assertEquals(false, widget.showTemp)
    }
}