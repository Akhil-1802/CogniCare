import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Users,
  Plus,
  Phone,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Calendar,
} from "lucide-react-native";
import { colors } from "../../../src/theme/colors";
import { Header } from "../../../src/components/ui/Header";
import { Card } from "../../../src/components/ui/Card";
import { Button } from "../../../src/components/ui/Button";
import { Input } from "../../../src/components/ui/Input";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { useAuth } from "../../../src/context/AuthContext";
import type { Patient } from "../../../src/types";

export default function MyPatientsScreen() {
  const router = useRouter();
  const { patients, refreshPatients, addPatient, setSelectedPatient } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // New patient form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Newly created patient credentials modal
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPatients();
    setRefreshing(false);
  };

  const handleAddPatient = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter patient name, phone, and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await addPatient({
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim() || "Home",
        password,
      });

      setModalVisible(false);
      setName("");
      setPhone("");
      setLocation("");
      setPassword("");

      // Show generated ID
      setCreatedPatientId(res.patient_id);
    } catch (err: any) {
      Alert.alert(
        "Failed to add patient",
        err.response?.data?.detail || err.message || "An error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="My Patients"
        subtitle={`${patients.length} active registered patients`}
        rightAction={
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {patients.length === 0 ? (
          <EmptyState
            icon={<Users size={36} color={colors.primary} />}
            title="No Patients Added"
            message="Add a patient to monitor their daily routines and assist their memory."
            actionTitle="Add New Patient"
            onAction={() => setModalVisible(true)}
          />
        ) : (
          patients.map((p) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.75}
              onPress={() => {
                setSelectedPatient(p);
                router.push(`/(caregiver)/patients/${p.id}` as any);
              }}
            >
              <Card style={styles.patientCard}>
                <View style={styles.cardRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarLetter}>
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.infoWrap}>
                    <Text style={styles.patientName}>{p.name}</Text>
                    <View style={styles.metaRow}>
                      <ShieldCheck size={14} color={colors.primary} />
                      <Text style={styles.patientIdText}>{p.id}</Text>
                    </View>

                    <View style={styles.detailsRow}>
                      <Phone size={12} color={colors.textSecondary} />
                      <Text style={styles.detailsText}>{p.phone}</Text>
                      {p.location ? (
                        <>
                          <Text style={styles.dot}>•</Text>
                          <MapPin size={12} color={colors.textSecondary} />
                          <Text style={styles.detailsText}>{p.location}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>

                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Patient Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Patient</Text>
            <Text style={styles.modalSubtitle}>
              Create a patient profile. An auto-generated PAT ID will be provided for them to sign in.
            </Text>

            <Input
              label="Patient Full Name"
              placeholder="e.g. Robert Smith"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Contact Phone"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Residence / Location"
              placeholder="e.g. Room 204 or Home"
              value={location}
              onChangeText={setLocation}
            />

            <Input
              label="Patient Portal Password"
              placeholder="Temporary password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Create Patient"
                onPress={handleAddPatient}
                loading={submitting}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Created Patient Credentials Success Modal */}
      <Modal
        visible={!!createdPatientId}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatedPatientId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconCircle}>
              <ShieldCheck size={36} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Patient Registered!</Text>
            <Text style={styles.successSub}>
              Share the following credentials with your patient or configure their phone:
            </Text>

            <View style={styles.credBox}>
              <Text style={styles.credLabel}>Patient ID (Login)</Text>
              <Text style={styles.credValue}>{createdPatientId}</Text>
            </View>

            <Button
              title="Done"
              onPress={() => setCreatedPatientId(null)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
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
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  patientCard: {
    padding: 16,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  infoWrap: {
    flex: 1,
    marginRight: 8,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  patientIdText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginLeft: 4,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  detailsText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  dot: {
    marginHorizontal: 6,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
  },
  successSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  credBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginVertical: 14,
  },
  credLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  credValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 4,
    letterSpacing: 1.5,
  },
});
