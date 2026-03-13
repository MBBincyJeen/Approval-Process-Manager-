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

// Helper function for date formatting
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

// Helper for Amount formatting - Now uses INR (Indian Rupees)
function formatAmount(amount) {
    if (amount === null || amount === undefined || amount === 0) {
        return '₹N/A';
    }
    // Ensures a standard currency format (e.g., ₹1,234.50)
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}


export default function ProprietorScreen({ user, profile, coordinatorProfile }) {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comment, setComment] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [resolvedCoordinator, setResolvedCoordinator] = useState(null);

  useEffect(() => {
    console.log('Proprietor profile.id:', profile?.id);
    console.log('Coordinator profile.id (prop):', coordinatorProfile?.id);
  }, [profile, coordinatorProfile]);

  // Fetch coordinator profile fallback if undefined
  useEffect(() => {
    const fetchCoordinatorProfile = async () => {
      if (!coordinatorProfile?.id) {
        console.log('Coordinator profile missing, fetching fallback...');
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'coordinator')
          .limit(1)
          .maybeSingle();

        if (error) console.error('Error fetching fallback coordinator:', error.message);
        else if (data) {
          console.log('Fetched fallback coordinator ID:', data.id);
          setResolvedCoordinator(data);
        }
      } else {
        setResolvedCoordinator(coordinatorProfile);
      }
    };
    fetchCoordinatorProfile();
  }, [coordinatorProfile]);

  // once resolved coordinator found, fetch requests
  useEffect(() => {
    if (resolvedCoordinator?.id) {
      fetchRequests();
    }
  }, [resolvedCoordinator]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        if (resolvedCoordinator?.id) fetchRequests();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [resolvedCoordinator]);

  // Search filter
  useEffect(() => {
    if (!search.trim()) setFiltered(requests);
    else {
      const q = search.trim().toLowerCase();
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

  // Fetch requests
  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .or('status.eq.approved,requester_role.eq.approver')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // filter out already handled ones (proprietor_approved, rejected, fulfilled)
      const filteredData = data.filter(r => r.status === 'approved');

      setRequests(filteredData);
      setFiltered(filteredData);
    } catch (error) {
      Alert.alert('Error fetching requests', error.message);
    }
  };

  // Helpers
  const getStatusColor = (status) => {
    if (status === 'fulfilled') return '#4D8462'; // Primary Green
    if (status === 'rejected') return '#c0392b'; // Dark Red
    if (status === 'approved') return '#FFAC16'; // Orange/Amber for pending proprietor action
    return '#A0A0A0';
  };

  const openRequestModal = (request) => {
    setSelectedRequest(request);
    setComment('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setComment('');
    setModalVisible(false);
  };

  const handleProprietorAction = async (requestId, action) => {
    const newStatus = action === 'approve' ? 'proprietor_approved' : 'rejected';
    const { error } = await supabase
      .from('requests')
      .update({
        status: newStatus,
        proprietor_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await supabase.from('request_history').insert([
        {
          request_id: requestId,
          user_id: user.id,
          action: newStatus,
          comment,
          timestamp: new Date().toISOString(),
        },
      ]);
      Alert.alert('Success', `Request marked as ${newStatus}`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setFiltered(prev => prev.filter(r => r.id !== requestId));
      closeModal();
    }
  };

  // ================= UI ==================
  return (
    <View style={styles.container}>
      {/* Header and Search Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={22} color={Colors.gray} style={styles.searchIcon} />
          <TextInput
            placeholder="Search requests"
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.gray}
          />
        </View>
      </View>

      {/* Profile Section */}
      <View style={styles.profileBox}>
        <View style={styles.profileItem}>
          <Icon name="person-outline" size={20} color={Colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileName}>{profile.full_name}</Text>
        </View>

        <View style={styles.profileItem}>
          <Icon name="mail-outline" size={20} color={Colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileEmail}>{profile.email}</Text>
        </View>

        <View style={[styles.profileItem, styles.roleItem]}>
          <Icon name="verified-user" size={20} color={Colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileRole}>
            {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
          </Text>
        </View>
      </View>

      {/* Requests List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.requestItem, { borderLeftColor: getStatusColor(item.status) }]}
            onPress={() => openRequestModal(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.title}>{item.title}</Text>
            
            {/* Category is on one line */}
            <View style={styles.detailRow}>
                <Text style={styles.detailText}>
                    <Text style={{fontWeight: '600'}}>Category:</Text> {item.category || 'N/A'}
                </Text>
            </View>
            
            {/* Amount is now on its own line below category */}
            <Text style={styles.amountLine}>
                <Text style={{fontWeight: '600', color: colors.textDark}}>Amount:</Text> {formatAmount(item.amount)}
            </Text>

            <Text style={styles.statusLine}>
              Status:{' '}
              <Text style={{ color: getStatusColor(item.status), fontWeight: '600' }}>
                {item.status}
              </Text>
            </Text>
            {item.created_at && (
              <Text style={styles.createdAt}>Created: {formatDate(item.created_at)}</Text>
            )}
            <Icon name="chevron-right" size={24} color="#555" style={styles.chevron} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No requests requiring your approval found.</Text>}
      />

      {/* Modal (Styled) */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedRequest && (
              <>
                <Text style={styles.modalTitle}>Review Request: {selectedRequest.title}</Text>
                <View style={styles.modalDetails}>
                    <Text style={styles.modalDetailText}>
                      <Text style={styles.modalDetailLabel}>Category:</Text> {selectedRequest.category || 'N/A'}
                    </Text>
                    {/* MODAL AMOUNT DISPLAY (Rupees) */}
                    <Text style={styles.modalDetailText}>
                      <Text style={styles.modalDetailLabel}>Amount:</Text> {formatAmount(selectedRequest.amount)}
                    </Text>
                    <Text style={[styles.modalDetailText, { marginBottom: 15 }]}>
                      <Text style={styles.modalDetailLabel}>Requester Comment:</Text> {selectedRequest.comments || 'N/A'}
                    </Text>
                </View>

                <TextInput
                  placeholder="Add comment for history (optional)"
                  style={styles.commentInput}
                  multiline
                  value={comment}
                  onChangeText={setComment}
                  placeholderTextColor="#999"
                />

                <View style={styles.buttonsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleProprietorAction(selectedRequest.id, 'approve')}
                  >
                    <Icon name="check-circle" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Fulfill</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleProprietorAction(selectedRequest.id, 'reject')}
                  >
                    <Icon name="cancel" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={closeModal}
                >
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

// ================= STYLES ==================
const colors = {
  primary: '#4D8462', // Green
  secondary: '#FFAC16', // Orange/Amber
  reject: '#c0392b', // Dark Red
  white: '#FFFFFF',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textDark: '#333333',
  textGray: '#777777',
  border: '#E0E0E0',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 5,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  searchIcon: {
    paddingLeft: 14,
  },
  search: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: colors.textDark,
  },

  // --- Profile Box Styles (Unchanged) ---
  profileBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginHorizontal: 5,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.border,
      },
    }),
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  profileIcon: {
    marginRight: 10,
    opacity: 0.8,
  },
  profileName: {
    fontWeight: '700',
    fontSize: 18,
    color: colors.textDark,
  },
  profileEmail: {
    fontSize: 16,
    color: colors.textGray,
  },
  roleItem: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 5,
  },
  profileRole: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  // --- End Profile Box Styles ---

  listContainer: {
    paddingHorizontal: 5,
    paddingBottom: 100,
  },
  requestItem: {
    borderLeftWidth: 5,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  title: { 
    fontWeight: '700', 
    fontSize: 17, 
    color: colors.textDark,
    marginBottom: 4,
  },
  // Row for category (now occupies full width)
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
    marginTop: 2,
  },
  detailText: {
    fontSize: 14,
    color: colors.textDark,
    flexShrink: 1, 
    width: '100%',
  },
  // New line for Amount
  amountLine: {
    fontSize: 14,
    color: colors.textDark,
    marginBottom: 4,
    // Add margin to make it visually distinct from status
  },
  statusLine: {
    fontSize: 14,
    color: colors.textDark,
  },
  createdAt: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
  },
  chevron: {
    position: 'absolute',
    right: 10,
    top: '40%',
  },
  emptyText: { 
    marginTop: 60, 
    color: colors.textGray, 
    textAlign: 'center',
    fontSize: 16,
  },

  // --- Modal Styles (Unchanged) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalTitle: { 
    fontSize: 20, 
    color: colors.primary, 
    fontWeight: '700', 
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  modalDetails: {
    marginBottom: 10,
  },
  modalDetailText: {
    fontSize: 15,
    color: colors.textDark,
    marginVertical: 3,
  },
  modalDetailLabel: {
    fontWeight: '600',
    color: colors.textDark,
  },
  commentInput: {
    marginTop: 15,
    padding: 12,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.textDark,
  },
  buttonsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20, 
    marginBottom: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    minWidth: '48%',
  },
  approveButton: {
    backgroundColor: colors.primary,
  },
  rejectButton: {
    backgroundColor: colors.reject,
  },
  cancelButton: {
    backgroundColor: colors.border,
    marginTop: 10,
    minWidth: '100%',
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
});
