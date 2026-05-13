import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import Slider from '@react-native-community/slider';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons'; // <-- NEW: Professional Icons
import { API_URL } from '@env';
// --- YOUR GLOBAL BACKEND ENGINE ---
const NGROK_URL = API_URL;
export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [lockStatus, setLockStatus] = useState('System Locked');

  const [stats, setStats] = useState({ battery: '--', charging: false, volume: 0 });
  const [apps, setApps] = useState([]);
  const [sysStatus, setSysStatus] = useState('System Online');

  // --- THE ENGINE LOOP ---
  useEffect(() => {
    let interval;
    if (!isLocked) {
      fetchStats();
      fetchApps();
      interval = setInterval(() => {
        fetchStats();
        fetchApps();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isLocked]);

  // --- API COMMANDS ---
  const attemptLogin = async () => {
    setLockStatus("Authenticating...");
    try {
      const res = await fetch(`${NGROK_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin })
      });
      if (res.ok) {
        setIsLocked(false);
      } else {
        setLockStatus("Access Denied. Invalid PIN.");
        setPin('');
      }
    } catch (err) {
      setLockStatus("Connection Error.");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${NGROK_URL}/api/stats`);
      const data = await res.json();
      setStats({ battery: data.battery, charging: data.charging, volume: data.volume });
    } catch (err) { }
  };

  const fetchApps = async () => {
    try {
      const res = await fetch(`${NGROK_URL}/api/apps`);
      const data = await res.json();
      setApps(data.apps || []);
    } catch (err) { }
  };

  const sendCommand = async (route) => {
    setSysStatus("Executing command...");
    try {
      const res = await fetch(`${NGROK_URL}${route}`, { method: 'POST' });
      const data = await res.json();
      setSysStatus(data.message);
      setTimeout(() => setSysStatus('System Online'), 3000);
    } catch (err) { }
  };

  const sendDataCommand = async (route, payload) => {
    setSysStatus("Processing...");
    try {
      const res = await fetch(`${NGROK_URL}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSysStatus(data.message);
      fetchApps();
      setTimeout(() => setSysStatus('System Online'), 3000);
    } catch (err) { }
  };

  const handleVolumeRelease = async (val) => {
    setSysStatus("Adjusting volume...");
    try {
      await fetch(`${NGROK_URL}/api/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: val })
      });
      setSysStatus('System Online');
    } catch (err) { }
  };

  // --- UI: THE LOCK SCREEN ---
  if (isLocked) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.lockContainer}>
        <StatusBar barStyle="light-content" />
        <MaterialCommunityIcons name="shield-lock-outline" size={80} color="#38bdf8" style={{ marginBottom: 20 }} />
        <Text style={styles.lockTitle}>SYNC SECURE</Text>
        <TextInput
          style={styles.pinInput} placeholder="Enter 4-Digit PIN" placeholderTextColor="#64748b"
          keyboardType="numeric" secureTextEntry={true} maxLength={4}
          value={pin} onChangeText={setPin}
        />
        <TouchableOpacity style={styles.unlockBtn} onPress={attemptLogin}>
          <Text style={styles.unlockBtnText}>AUTHORIZE</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>{lockStatus}</Text>
      </KeyboardAvoidingView>
    );
  }

  // --- UI: THE MAIN DASHBOARD ---
  return (
    <View style={styles.bg}>
      <StatusBar barStyle="light-content" />

      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <View>
          <Text style={styles.navTitle}>SYNC</Text>
          <Text style={styles.navSubtitle}>Remote Workspace</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Connected</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.dashboardContainer} showsVerticalScrollIndicator={false}>

        {/* STATS GRID */}
        <View style={styles.grid}>
          <View style={styles.cardHalf}>
            <View style={styles.cardHeader}>
              <Feather name={stats.charging ? "battery-charging" : "battery"} size={18} color="#94a3b8" />
              <Text style={styles.label}>POWER</Text>
            </View>
            <Text style={styles.statNumber}>{stats.battery}%</Text>
          </View>

          <View style={styles.cardHalf}>
            <View style={styles.cardHeader}>
              <Feather name={stats.volume > 0 ? "volume-2" : "volume-x"} size={18} color="#94a3b8" />
              <Text style={styles.label}>VOLUME</Text>
            </View>
            <Text style={styles.statNumber}>{stats.volume}%</Text>
          </View>
        </View>

        {/* SYSTEM CONTROLS */}
        <View style={styles.cardFull}>
          <Text style={styles.sectionTitle}>System Controls</Text>

          <TouchableOpacity style={styles.lockBtn} onPress={() => sendCommand('/api/lock')}>
            <Feather name="lock" size={20} color="#f87171" />
            <Text style={styles.lockBtnText}>LOCK WORKSTATION</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 25, marginBottom: 15 }]}>MASTER VOLUME</Text>
          <View style={styles.sliderContainer}>
            <Feather name="volume" size={20} color="#64748b" />
            <Slider
              style={{ flex: 1, marginHorizontal: 15, height: 40 }}
              minimumValue={0} maximumValue={100} step={1} value={stats.volume}
              onValueChange={(val) => setStats({ ...stats, volume: val })}
              onSlidingComplete={handleVolumeRelease}
              minimumTrackTintColor="#38bdf8"
              maximumTrackTintColor="#334155"
              thumbTintColor="#38bdf8"
            />
            <Feather name="volume-2" size={20} color="#64748b" />
          </View>
        </View>

        {/* MEDIA PLAYBACK */}
        <View style={styles.cardFull}>
          <Text style={styles.sectionTitle}>Media Playback</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => sendDataCommand('/api/media', { action: 'prev' })}>
              <Ionicons name="play-skip-back" size={24} color="#e2e8f0" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, styles.playBtn]} onPress={() => sendDataCommand('/api/media', { action: 'playpause' })}>
              <MaterialCommunityIcons name="play-pause" size={32} color="#0f172a" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => sendDataCommand('/api/media', { action: 'next' })}>
              <Ionicons name="play-skip-forward" size={24} color="#e2e8f0" />
            </TouchableOpacity>
          </View>
        </View>

        {/* QUICK LAUNCH */}
        <View style={styles.cardFull}>
          <Text style={styles.sectionTitle}>App Launcher</Text>
          <View style={styles.launchGrid}>
            <TouchableOpacity style={styles.launcherItem} onPress={() => sendDataCommand('/api/launch', { id: 'chrome' })}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <MaterialCommunityIcons name="google-chrome" size={28} color="#3b82f6" />
              </View>
              <Text style={styles.launcherText}>Chrome</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.launcherItem} onPress={() => sendDataCommand('/api/launch', { id: 'spotify' })}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <MaterialCommunityIcons name="spotify" size={28} color="#22c55e" />
              </View>
              <Text style={styles.launcherText}>Spotify</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.launcherItem} onPress={() => sendDataCommand('/api/launch', { id: 'edge' })}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
                <MaterialCommunityIcons name="microsoft-edge" size={28} color="#0ea5e9" />
              </View>
              <Text style={styles.launcherText}>Edge</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.launcherItem} onPress={() => sendDataCommand('/api/launch', { id: 'opera' })}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <MaterialCommunityIcons name="opera" size={28} color="#ef4444" />
              </View>
              <Text style={styles.launcherText}>Opera</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RUNNING APPS */}
        <View style={[styles.cardFull, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>Active Processes</Text>
          {apps.length === 0 ? <Text style={styles.emptyText}>No tracked processes running.</Text> : null}

          {apps.map((app, index) => (
            <View key={index} style={styles.appRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.processDot} />
                <Text style={styles.appName}>{app}</Text>
              </View>
              <TouchableOpacity style={styles.killBtn} onPress={() => sendDataCommand('/api/kill', { name: app })}>
                <Feather name="x" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Floating Status Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>{sysStatus}</Text>
      </View>
    </View>
  );
}

// --- PRO STYLESHEET ---
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0f172a' }, // Deep Slate background
  lockContainer: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 20 },

  // Typography
  lockTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '800', letterSpacing: 3, marginBottom: 40 },
  navTitle: { color: '#f8fafc', fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  navSubtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '600', marginBottom: 20, letterSpacing: 0.5 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', letterSpacing: 1.5, marginLeft: 8 },
  statNumber: { color: '#f8fafc', fontSize: 36, fontWeight: '300', marginTop: 10 },

  // Inputs & Buttons
  pinInput: { backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 24, textAlign: 'center', padding: 18, borderRadius: 12, width: '70%', marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  unlockBtn: { backgroundColor: '#38bdf8', paddingVertical: 16, paddingHorizontal: 50, borderRadius: 12, shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  unlockBtnText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold', letterSpacing: 1.5 },
  errorText: { color: '#ef4444', marginTop: 25, fontWeight: '500' },

  // Layout
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, backgroundColor: '#0f172a' },
  dashboardContainer: { paddingHorizontal: 20, paddingTop: 10 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },

  // Cards
  cardHalf: { backgroundColor: '#1e293b', flex: 0.48, padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 3 },
  cardFull: { backgroundColor: '#1e293b', padding: 25, borderRadius: 20, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },

  // Controls
  lockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  lockBtnText: { color: '#f87171', fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 15, borderRadius: 15 },

  // Media & App Grid
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  iconBtn: { backgroundColor: '#334155', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  playBtn: { backgroundColor: '#38bdf8', width: 75, height: 75, borderRadius: 40, shadowColor: '#38bdf8', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  launchGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  launcherItem: { alignItems: 'center', flex: 1 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  launcherText: { color: '#cbd5e1', fontSize: 12, fontWeight: '500' },

  // Processes
  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  processDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 12 },
  appName: { color: '#e2e8f0', fontSize: 16, fontWeight: '500' },
  killBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: 8, borderRadius: 8 },
  emptyText: { color: '#64748b', fontStyle: 'italic', marginTop: 5 },

  // Status Bar
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 },
  statusText: { color: '#10b981', fontSize: 12, fontWeight: 'bold' },
  bottomBar: { backgroundColor: '#0f172a', paddingVertical: 15, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1e293b' },
  bottomText: { color: '#64748b', fontSize: 12, fontWeight: '500', letterSpacing: 1 }
});