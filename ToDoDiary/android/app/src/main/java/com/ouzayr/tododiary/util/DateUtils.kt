package com.ouzayr.tododiary.util

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.IsoFields
import java.time.temporal.WeekFields
import java.util.Locale

/**
 * Date and ISO-week helpers. Week IDs are always ISO-8601 ("2026-W28") so both
 * the Android and web apps agree on which tasks belong to which week, while the
 * *displayed* week range follows the device locale's first day of week.
 */
object DateUtils {

    private val ISO_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    fun format(date: LocalDate): String = date.format(ISO_DATE)

    fun parse(value: String): LocalDate = LocalDate.parse(value, ISO_DATE)

    /** ISO year-week key, e.g. "2026-W28". */
    fun weekId(date: LocalDate): String {
        val week = date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)
        val year = date.get(IsoFields.WEEK_BASED_YEAR)
        return "%d-W%02d".format(year, week)
    }

    /** First day of the week containing [date], honouring the device locale. */
    fun startOfDisplayWeek(date: LocalDate, locale: Locale = Locale.getDefault()): LocalDate {
        val firstDay = WeekFields.of(locale).firstDayOfWeek
        var d = date
        while (d.dayOfWeek != firstDay) d = d.minusDays(1)
        return d
    }

    /** The 7 dates of the display week containing [date]. */
    fun displayWeekDates(date: LocalDate, locale: Locale = Locale.getDefault()): List<LocalDate> {
        val start = startOfDisplayWeek(date, locale)
        return (0L..6L).map { start.plusDays(it) }
    }

    /** "7 – 13 Jul · 2026-W28" style header for the week containing [date]. */
    fun weekHeader(date: LocalDate, locale: Locale = Locale.getDefault()): String {
        val days = displayWeekDates(date, locale)
        val first = days.first()
        val last = days.last()
        val range = if (first.month == last.month) {
            "${first.dayOfMonth}–${last.dayOfMonth} ${last.month.getDisplayName(TextStyle.SHORT, locale)}"
        } else {
            "${first.dayOfMonth} ${first.month.getDisplayName(TextStyle.SHORT, locale)} – " +
                "${last.dayOfMonth} ${last.month.getDisplayName(TextStyle.SHORT, locale)}"
        }
        return "$range · ${weekId(date)}"
    }

    /** "Mon 13 Jul 2026" style header for a daily page. */
    fun dayHeader(date: LocalDate, locale: Locale = Locale.getDefault()): String {
        val dow = date.dayOfWeek.getDisplayName(TextStyle.SHORT, locale)
        val month = date.month.getDisplayName(TextStyle.SHORT, locale)
        return "$dow ${date.dayOfMonth} $month ${date.year}"
    }

    /** Short tag like "→ 14 Jul" for carried tasks. */
    fun carriedTag(target: String, locale: Locale = Locale.getDefault()): String {
        return try {
            val d = parse(target)
            "→ ${d.dayOfMonth} ${d.month.getDisplayName(TextStyle.SHORT, locale)}"
        } catch (e: Exception) {
            "→ $target"
        }
    }
}
