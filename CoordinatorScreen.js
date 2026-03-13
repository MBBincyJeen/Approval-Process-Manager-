import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from './supabaseClient';
import { Colors } from './theme';

// Format date nicely
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format INR properly
function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === 0) return '₹N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function CoordinatorScreen({ user, profile }) {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, fetchRequests)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (!search.trim()) setFiltered(requests);
    else {
      const q = search.toLowerCase();
      setFiltered(
        requests.filter(
          (r) =>
            (r.title && r.title.toLowerCase().includes(q)) ||
            (r.category && r.category.toLowerCase().includes(q)) ||
            (r.comments && r.comments.toLowerCase().includes(q))
        )
      );
    }
  }, [search, requests]);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'proprietor_approved')
      .order('created_at', { ascending: false });

    if (!error) {
      setRequests(data);
      setFiltered(data);
    }
  };

  const handleAction = async (id) => {
    const { error } = await supabase
      .from('requests')
      .update({
        status: 'fulfilled',
        coordinator_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (!error) {
      await supabase.from('request_history').insert([
        {
          request_id: id,
          user_id: user.id,
          action: 'fulfilled',
          comment,
          timestamp: new Date().toISOString(),
        },
      ]);

      setRequests((p) => p.filter((r) => r.id !== id));
      setFiltered((p) => p.filter((r) => r.id !== id));
      closeModal();
      Alert.alert('Success', 'Request fulfilled');
    }
  };

  const openRequestModal = (r) => {
    setSelectedRequest(r);
    setComment('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setComment('');
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Search & Profile */}
      <View style={styles.profileBox}>
        <View style={styles.profileItem}>
          <Icon name="person-outline" size={20} color={colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileName}>{profile.full_name}</Text>
        </View>

        <View style={styles.profileItem}>
          <Icon name="mail-outline" size={20} color={colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileEmail}>{profile.email}</Text>
        </View>

        <View style={[styles.profileItem, styles.roleItem]}>
          <Icon name="verified-user" size={20} color={colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileRole}>{profile.role}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={22} color={colors.textGray} style={styles.searchIcon} />
        <TextInput
          placeholder="Search requests"
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.textGray}
        />
      </View>

      {/* Requests List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.requestItem, { borderLeftColor: colors.primary }]}
            onPress={() => openRequestModal(item)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.detailText}><Text style={{ fontWeight: '600' }}>Category:</Text> {item.category}</Text>
            <Text style={styles.detailText}><Text style={{ fontWeight: '600' }}>Amount:</Text> {formatAmount(item.amount)}</Text>
            <Text style={styles.createdAt}>Created: {formatDate(item.created_at)}</Text>
            <Icon name="chevron-right" size={24} color="#555" style={styles.chevron} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No requests found.</Text>}
      />

      {/* Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedRequest && (
              <>
                <Text style={styles.modalTitle}>{selectedRequest.title}</Text>
                <Text style={styles.modalDetailText}><Text style={styles.modalDetailLabel}>Category:</Text> {selectedRequest.category}</Text>
                <Text style={styles.modalDetailText}><Text style={styles.modalDetailLabel}>Amount:</Text> {formatAmount(selectedRequest.amount)}</Text>

                <TextInput
                  placeholder="Add comment (optional)"
                  style={styles.commentInput}
                  multiline
                  value={comment}
                  onChangeText={setComment}
                />

                <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleAction(selectedRequest.id)}>
                  <Icon name="check-circle" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Mark Fulfilled</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={closeModal}>
                  <Text style={[styles.actionButtonText, { color: '#555' }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// SAME STYLING USED IN PROPRIETOR SCREEN:
const colors = {
  primary: '#4D8462',
  white: '#FFFFFF',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textDark: '#333',
  textGray: '#777',
  border: '#E0E0E0',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 12, paddingTop: 50 },

  searchContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIcon: { paddingLeft: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textDark },

  profileBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  profileItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  profileIcon: { marginRight: 10 },
  profileName: { fontWeight: '700', fontSize: 18, color: colors.textDark },
  profileEmail: { fontSize: 16, color: colors.textGray },
  roleItem: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 5, paddingTop: 8 },
  profileRole: { fontWeight: '700', fontSize: 16, color: colors.primary },

  listContainer: { paddingBottom: 100 },
  requestItem: {
    borderLeftWidth: 5,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
  },
  title: { fontWeight: '700', fontSize: 17, color: colors.textDark, marginBottom: 6 },
  detailText: { fontSize: 14, color: colors.textDark },
  createdAt: { fontSize: 12, color: colors.textGray, marginTop: 6 },
  chevron: { position: 'absolute', right: 10, top: '40%' },
  emptyText: { marginTop: 60, textAlign: 'center', color: colors.textGray },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '90%', backgroundColor: colors.card, padding: 24, borderRadius: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: 14 },
  modalDetailText: { fontSize: 15, marginVertical: 4, color: colors.textDark },
  modalDetailLabel: { fontWeight: '600' },
  commentInput: {
    marginTop: 15, padding: 12, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, minHeight: 80, textAlignVertical: 'top'
  },

  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 15 },
  approveButton: { backgroundColor: colors.primary },
  cancelButton: { backgroundColor: colors.border },
  actionButtonText: { fontSize: 16, fontWeight: '700', marginLeft: 8, color: colors.white },
});
