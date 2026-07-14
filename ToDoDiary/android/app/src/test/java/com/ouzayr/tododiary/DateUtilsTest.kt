package com.ouzayr.tododiary

import com.ouzayr.tododiary.util.DateUtils
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.util.Locale

class DateUtilsTest {

    @Test
    fun isoWeekIdMatchesKnownWeeks() {
        assertEquals("2026-W29", DateUtils.weekId(LocalDate.of(2026, 7, 13))) // Monday
        assertEquals("2026-W29", DateUtils.weekId(LocalDate.of(2026, 7, 19))) // Sunday same ISO week
        // ISO edge: 1 Jan 2027 is a Friday -> week 53 of 2026
        assertEquals("2026-W53", DateUtils.weekId(LocalDate.of(2027, 1, 1)))
    }

    @Test
    fun displayWeekRespectsLocaleFirstDay() {
        val wed = LocalDate.of(2026, 7, 15)
        val ukWeek = DateUtils.displayWeekDates(wed, Locale.UK) // Monday start
        assertEquals(LocalDate.of(2026, 7, 13), ukWeek.first())
        assertEquals(7, ukWeek.size)
        val usWeek = DateUtils.displayWeekDates(wed, Locale.US) // Sunday start
        assertEquals(LocalDate.of(2026, 7, 12), usWeek.first())
    }

    @Test
    fun formatAndParseRoundTrip() {
        val d = LocalDate.of(2026, 1, 5)
        assertEquals(d, DateUtils.parse(DateUtils.format(d)))
        assertEquals("2026-01-05", DateUtils.format(d))
    }
}
