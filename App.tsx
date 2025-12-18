import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, Text, View, Button, ScrollView } from "react-native";
import { open } from "@op-engineering/op-sqlite";

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp =
      new Date().toLocaleTimeString() + "." + (Date.now() % 1000);
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  const runTest = async () => {
    setLogs([]);

    try {
      addLog("🧪 Starting Multi Connection Test");
      addLog("==================================");

      const writeDb = open({ name: "test.db" });
      addLog("✅ Write connection opened");

      const readDb = open({ name: "test.db" });
      addLog("✅ Read connection opened");

      await writeDb.execute("PRAGMA journal_mode = WAL");
      await writeDb.execute("PRAGMA synchronous = NORMAL");
      addLog("✅ Write connection configured");

      await readDb.execute("PRAGMA journal_mode = WAL");
      await readDb.execute("PRAGMA query_only = true");
      addLog("✅ Read connection configured (query_only)");

      await writeDb.execute(
        "CREATE TABLE IF NOT EXISTS test_data (id INTEGER PRIMARY KEY, value TEXT)"
      );
      addLog("✅ Table created");

      await writeDb.execute("INSERT INTO test_data (value) VALUES (?)", [
        "initial_row",
      ]);
      addLog("✅ Initial data inserted");

      addLog("🔒 Starting LONG WRITE on write connection (5000 inserts)...");
      const writeStartTime = Date.now();

      writeDb
        .execute(
          `
            WITH RECURSIVE cnt(x) AS (
               SELECT 1
               UNION ALL
               SELECT x+1 FROM cnt
               LIMIT 50000000
            )
            SELECT count(*) FROM cnt;
          `
        )
        .then(() => {
          const writeDuration = Date.now() - writeStartTime;
          addLog(`✅ Long write completed in ${writeDuration}ms`);
        });

      addLog("📖 Attempting READ on read connection while write is running...");
      const readStartTime = Date.now();
      let readDuration = 0;

      // Wait to make sure write has started
      await new Promise((resolve) => setTimeout(resolve, 100));

      readDb.execute("SELECT * FROM test_data").then((value) => {
        readDuration = Date.now() - readStartTime;
        addLog(`✅ Read completed in ${readDuration}ms`);
      });
    } catch (error) {
      addLog(`❌ ERROR: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>op-sqlite Multi Connection Test</Text>

      <View style={styles.buttonContainer}>
        <Button title={"Run Test"} onPress={runTest} />
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text
            key={index}
            style={[
              styles.logText,
              log.includes("❌") && styles.errorLog,
              log.includes("✅") && styles.successLog,
              log.includes("==") && styles.separatorLog,
            ]}
          >
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  buttonContainer: {
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  logContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
  },
  logText: {
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 4,
    color: "#333",
  },
  errorLog: {
    color: "#d32f2f",
    fontWeight: "600",
  },
  successLog: {
    color: "#388e3c",
  },
  separatorLog: {
    fontWeight: "bold",
    marginTop: 8,
  },
});
