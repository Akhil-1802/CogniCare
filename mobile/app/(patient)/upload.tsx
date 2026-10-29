import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Camera,
  Upload,
  FileText,
  CheckCircle,
  Plus,
  ArrowRight,
  Pill,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Header } from "../../src/components/ui/Header";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { DocumentsApi } from "../../src/api/documents";
import { RemindersApi, todayISO } from "../../src/api/reminders";
import { useAuth } from "../../src/context/AuthContext";
import type { ExtractedMedication, ReminderDraft } from "../../src/types";

export default function UploadMedicineScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [medications, setMedications] = useState<ExtractedMedication[]>([]);

  const handleCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission", "Camera access is needed to scan prescriptions.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });

      if (!res.canceled && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedImageUri(asset.uri);
        await processOcr(asset.uri, asset.fileName || "prescription.jpg", asset.mimeType || "image/jpeg");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to capture photo.");
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
      });

      if (!res.canceled && res.assets.length > 0) {
        const doc = res.assets[0];
        setSelectedImageUri(doc.uri);
        await processOcr(doc.uri, doc.name, doc.mimeType || "application/pdf");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to select document.");
    }
  };

  const processOcr = async (uri: string, name: string, mime: string) => {
    setLoading(true);
    setMedications([]);
    setSummary(null);

    try {
      const scanRes = await DocumentsApi.scanDocumentPreview(uri, name, mime);
      if (scanRes.extracted_data) {
        setSummary(scanRes.extracted_data.summary);
        setMedications(scanRes.extracted_data.medications || []);
      }
    } catch (err: any) {
      Alert.alert(
        "Scanning Failed",
        err.response?.data?.detail || "Could not extract medication information from this file."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddToRoutine = async () => {
    if (!user || medications.length === 0) return;
    setSaving(true);

    try {
      const drafts: ReminderDraft[] = medications.map((m) => ({
        title: m.name,
        type: "medicine",
        dosage: m.dosage,
        reminder_time: m.timing ? m.timing.slice(0, 5) : "08:00",
        notes: `${m.frequency || ""} - ${m.instructions || ""}`,
      }));

      await RemindersApi.addRemindersBulk(user.id, todayISO(), drafts);
      Alert.alert(
        "Routine Updated",
        `Added ${medications.length} medications to today's schedule!`,
        [
          {
            text: "View Routine",
            onPress: () => router.push("/(patient)/routine"),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to save reminders to routine.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Scan Prescription" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Selector Cards */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.selectorCard} onPress={handleCapture}>
            <View style={[styles.selectorIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Camera size={28} color={colors.primary} />
            </View>
            <Text style={styles.selectorTitle}>Take Photo</Text>
            <Text style={styles.selectorSub}>Medicine bottle or paper</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.selectorCard} onPress={handlePickDocument}>
            <View style={[styles.selectorIconWrap, { backgroundColor: colors.secondaryLight }]}>
              <Upload size={28} color={colors.secondary} />
            </View>
            <Text style={styles.selectorTitle}>Upload File</Text>
            <Text style={styles.selectorSub}>Image or PDF document</Text>
          </TouchableOpacity>
        </View>

        {/* Selected image preview */}
        {selectedImageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          </View>
        ) : null}

        {/* Loading Spinner */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Processing OCR with Tesseract...</Text>
            <Text style={styles.loadingSub}>
              Detecting medication names, dosages, and timings
            </Text>
          </View>
        ) : null}

        {/* Results */}
        {summary ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Medical Document Summary</Text>
            <Text style={styles.summaryText}>{summary}</Text>
          </Card>
        ) : null}

        {medications.length > 0 ? (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>
              Extracted Medications ({medications.length})
            </Text>

            {medications.map((med, index) => (
              <Card key={index} style={styles.medCard}>
                <View style={styles.medRow}>
                  <View style={styles.medIconCircle}>
                    <Pill size={22} color={colors.primary} />
                  </View>
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medDetails}>
                      Dosage: {med.dosage} • {med.frequency}
                    </Text>
                    {med.instructions ? (
                      <Text style={styles.medInstructions}>
                        {med.instructions}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label="Extracted" variant="success" />
                </View>
              </Card>
            ))}

            <Button
              title={`Add ${medications.length} Medications to Schedule`}
              onPress={handleAddToRoutine}
              loading={saving}
              style={styles.addBtn}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  selectorCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  selectorIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  selectorSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  previewContainer: {
    height: 180,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: colors.surfaceMuted,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  loadingBox: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  resultsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  medCard: {
    padding: 16,
    marginBottom: 10,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  medIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  medInfo: {
    flex: 1,
    marginRight: 10,
  },
  medName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  medDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  addBtn: {
    marginTop: 14,
  },
});
