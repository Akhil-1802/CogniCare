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
  Pill,
  User,
  CheckCircle,
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

export default function CaregiverUploadScreen() {
  const router = useRouter();
  const { patients, selectedPatient, setSelectedPatient } = useAuth();

  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [medications, setMedications] = useState<ExtractedMedication[]>([]);

  const handleCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission", "Camera access is needed.");
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
      Alert.alert("Error", err.message || "Failed to pick file.");
    }
  };

  const processOcr = async (uri: string, name: string, mime: string) => {
    if (!selectedPatient) {
      Alert.alert("Select Patient", "Please select a target patient before scanning.");
      return;
    }

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
        err.response?.data?.detail || "Could not extract medication information."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPatientRoutine = async () => {
    if (!selectedPatient || medications.length === 0) return;
    setSaving(true);

    try {
      const drafts: ReminderDraft[] = medications.map((m) => ({
        title: m.name,
        type: "medicine",
        dosage: m.dosage,
        reminder_time: m.timing ? m.timing.slice(0, 5) : "08:00",
        notes: `${m.frequency || ""} - ${m.instructions || ""}`,
      }));

      await RemindersApi.addRemindersBulk(selectedPatient.id, todayISO(), drafts);
      Alert.alert(
        "Schedule Updated",
        `Successfully added ${medications.length} medicines to ${selectedPatient.name}'s daily routine!`,
        [
          {
            text: "View Reminders",
            onPress: () => router.push(`/(caregiver)/patients/${selectedPatient.id}` as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to save reminders.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Prescription Scanner" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Selection Bar */}
        <Text style={styles.sectionHeading}>Target Patient</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {patients.map((p) => {
            const isSelected = selectedPatient?.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.patientChip, isSelected && styles.patientChipSelected]}
                onPress={() => setSelectedPatient(p)}
              >
                <Text
                  style={[
                    styles.patientChipText,
                    isSelected && styles.patientChipTextSelected,
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Action Selectors */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.selectorCard} onPress={handleCapture}>
            <View style={[styles.selectorIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Camera size={28} color={colors.primary} />
            </View>
            <Text style={styles.selectorTitle}>Capture Camera</Text>
            <Text style={styles.selectorSub}>Photograph prescription</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.selectorCard} onPress={handlePickDocument}>
            <View style={[styles.selectorIconWrap, { backgroundColor: colors.secondaryLight }]}>
              <Upload size={28} color={colors.secondary} />
            </View>
            <Text style={styles.selectorTitle}>Upload PDF / Image</Text>
            <Text style={styles.selectorSub}>Document file</Text>
          </TouchableOpacity>
        </View>

        {selectedImageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Extracting Prescriptions via OCR...</Text>
            <Text style={styles.loadingSub}>Analyzing medications and scheduling details</Text>
          </View>
        ) : null}

        {summary ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Medical Record Analysis</Text>
            <Text style={styles.summaryText}>{summary}</Text>
          </Card>
        ) : null}

        {medications.length > 0 ? (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionHeading}>
              Extracted Prescriptions ({medications.length})
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
                      {med.dosage} • {med.frequency}
                    </Text>
                    {med.instructions ? (
                      <Text style={styles.medInstructions}>
                        {med.instructions}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label="Ready" variant="success" />
                </View>
              </Card>
            ))}

            <Button
              title={`Save to ${selectedPatient?.name}'s Daily Schedule`}
              onPress={handleAddToPatientRoutine}
              loading={saving}
              style={{ marginTop: 14 }}
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
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  chipScroll: {
    marginBottom: 16,
  },
  patientChip: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  patientChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  patientChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  patientChipTextSelected: {
    color: "#ffffff",
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
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  selectorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  selectorSub: {
    fontSize: 11,
    color: colors.textSecondary,
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
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 12,
  },
  loadingSub: {
    fontSize: 12,
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
    marginTop: 10,
  },
  medCard: {
    padding: 14,
    marginBottom: 8,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  medIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  medInfo: {
    flex: 1,
    marginRight: 8,
  },
  medName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  medDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
});
