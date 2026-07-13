package com.ouzayr.tododiary

import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.model.TaskScope
import com.ouzayr.tododiary.model.TaskStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TaskMappingTest {

    @Test
    fun firestoreMapRoundTrip() {
        val task = Task(
            id = "abc",
            scope = TaskScope.DAY,
            pageDate = "2026-07-13",
            weekId = "2026-W29",
            rowIndex = 1720900000000L,
            status = TaskStatus.OPEN,
            inputType = InputType.TEXT,
            textContent = "Buy milk",
            createdAt = 1L,
            updatedAt = 2L,
        )
        val restored = Task.fromMap("abc", task.toMap())
        assertEquals(task, restored)
    }

    @Test
    fun unknownEnumValuesFallBackSafely() {
        val restored = Task.fromMap(
            "x",
            mapOf("scope" to "GALAXY", "status" to "???", "inputType" to null),
        )
        assertEquals(TaskScope.DAY, restored.scope)
        assertEquals(TaskStatus.OPEN, restored.status)
        assertEquals(InputType.TEXT, restored.inputType)
        assertNull(restored.pageDate)
    }
}
