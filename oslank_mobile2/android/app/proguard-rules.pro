# Flutter wrapper
#-keep class io.flutter.app.** { *; }
#-keep class io.flutter.plugin.**  { *; }
#-keep class io.flutter.util.**  { *; }
#-keep class io.flutter.view.**  { *; }
#-keep class io.flutter.**  { *; }
#-keep class io.flutter.plugins.**  { *; }

# sql_conn / JDBC rules
-keep class net.sourceforge.jtds.jdbc.** { *; }
-keep interface net.sourceforge.jtds.jdbc.** { *; }
-keep class com.microsoft.sqlserver.jdbc.** { *; }
-keep interface com.microsoft.sqlserver.jdbc.** { *; }
-keep class java.sql.** { *; }
-keep class com.amolg.sql_conn.** { *; }
-keep class sql_conn.** { *; }
-dontwarn net.sourceforge.jtds.jdbc.**
-dontwarn com.microsoft.sqlserver.jdbc.**
-dontwarn java.sql.**
-dontwarn javax.transaction.xa.**
-dontwarn javax.naming.**
