package com.ouzayr.tododiary.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ouzayr.tododiary.ui.daily.DailyScreen
import com.ouzayr.tododiary.ui.settings.SettingsScreen
import com.ouzayr.tododiary.ui.weekly.WeeklyScreen
import com.ouzayr.tododiary.util.DateUtils
import java.time.LocalDate

@Composable
fun AppNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = "daily/{date}") {
        composable(
            route = "daily/{date}",
            arguments = listOf(
                navArgument("date") {
                    type = NavType.StringType
                    defaultValue = "today"
                },
            ),
        ) { entry ->
            val arg = entry.arguments?.getString("date") ?: "today"
            val date = if (arg == "today") LocalDate.now() else runCatching { DateUtils.parse(arg) }.getOrDefault(LocalDate.now())
            DailyScreen(
                initialDate = date,
                onOpenWeekly = { d -> navController.navigate("weekly/${DateUtils.format(d)}") },
                onOpenSettings = { navController.navigate("settings") },
            )
        }
        composable(
            route = "weekly/{date}",
            arguments = listOf(
                navArgument("date") {
                    type = NavType.StringType
                    defaultValue = "today"
                },
            ),
        ) { entry ->
            val arg = entry.arguments?.getString("date") ?: "today"
            val date = if (arg == "today") LocalDate.now() else runCatching { DateUtils.parse(arg) }.getOrDefault(LocalDate.now())
            WeeklyScreen(
                initialDate = date,
                onOpenDay = { d ->
                    navController.navigate("daily/${DateUtils.format(d)}") {
                        popUpTo("daily/{date}") { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() },
            )
        }
        composable("settings") {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
