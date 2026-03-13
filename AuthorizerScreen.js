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
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from './supabaseClient';
import { Colors } from './theme'; // Assuming Colors is defined elsewhere, but using local color palette

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

// Helper for Amount formatting - Uses INR (Indian Rupees)
function formatAmount(amount) {
    if (amount === null || amount === undefined || amount === 0) {
        // Return ₹0.00 if amount is missing or zero, which looks cleaner than N/A
        return '₹0.00';
    }
    // Ensures a standard currency format (e.g., ₹1,234.50)
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}


// --- TimelineBar Component (Styles updated below) ---
const STATUS_STEPS = [
  { key: 'pending', label: 'Request Created' },
  { key: 'authorized', label: 'Authorization' },
  { key: 'approved', label: 'Approval' },
  { key: 'proprietor_approved', label: 'Proprietor' },
  { key: 'fulfilled', label: 'Fulfilled' },
];

function getStepIndex(status) {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function TimelineBar({ status }) {
  const stepIdx = getStepIndex(status);
  const isRejected = status === 'rejected';
  const rejectStepIndex = isRejected ? stepIdx : -1;

  const primaryColor = colors.primary; // Re-use defined primary color for clarity
  const rejectedColor = colors.reject;
  const inactiveColor = colors.gray;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', paddingLeft: 8 }}
    >
      <View style={styles.timelineRow}>
        {STATUS_STEPS.map((step, idx) => {
          const finished = idx <= stepIdx;
          const isRejectHere = idx === rejectStepIndex;

          // Determine dot color
          const colorDot = isRejected
            ? isRejectHere
              ? rejectedColor
              : colors.white // Inactive/non-rejected circles are white fill
            : finished
            ? primaryColor
            : colors.white; // Pending circles are white fill

          // Determine border color
          const borderDot = isRejected
            ? isRejectHere
              ? rejectedColor
              : inactiveColor
            : finished
            ? primaryColor
            : inactiveColor;

          // Determine line color
          const colorLine =
            isRejected && idx === rejectStepIndex - 1
              ? rejectedColor
              : idx < stepIdx
              ? primaryColor
              : inactiveColor;

          return (
            <View key={step.key} style={styles.timelineStepContainer}>
              <View
                style={[
                  styles.timelineCircle,
                  { backgroundColor: colorDot, borderColor: borderDot, borderWidth: 2 },
                ]}
              >
                {finished && !isRejected ? (
                  // Checkmark for finished steps
                  <Text style={[styles.timelineCheck, { backgroundColor: primaryColor }]}>{'\u2713'}</Text>
                ) : isRejectHere ? (
                  // Cross for rejected step
                  <Text style={[styles.timelineDash, { color: rejectedColor }]}>✗</Text>
                ) : (
                  // Dash for current/pending step
                  <Text style={styles.timelineDash}>–</Text>
                )}
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  {
                    color: isRejected && isRejectHere ? rejectedColor : finished ? primaryColor : colors.textGray,
                    fontWeight: finished || (isRejected && isRejectHere) ? 'bold' : 'normal',
                  },
                ]}
              >
                {step.label}
              </Text>
              {idx < STATUS_STEPS.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: colorLine }]} />
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}


// --- AuthorizerScreen Component ---
export default function AuthorizerScreen({ user, profile }) {
  const [activeTab, setActiveTab] = useState('authorization');
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editRequestId, setEditRequestId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [comments, setComments] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [authComment, setAuthComment] = useState('');

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('public:requests_authorizer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeTab]);

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

  const fetchRequests = async () => {
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (activeTab === 'authorization') {
      // Pending requests, not by the current user
      query = query.eq('status', 'pending').neq('requester_id', profile.id);
    } else if (activeTab === 'myrequests') {
      // All requests by the current user
      query = query.eq('requester_id', profile.id);
    }
    const { data, error } = await query;
    if (!error) {
      setRequests(data);
      setFiltered(data);
    } else {
      Alert.alert('Error fetching requests', error.message);
    }
  };

  const canEdit = (item) => item.requester_id === profile.id && item.status === 'pending';

  const handleDelete = async (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('requests').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchRequests();
        },
      },
    ]);
  };

  const openAddModal = () => {
    setEditMode(false);
    setEditRequestId(null);
    setTitle('');
    setCategory('');
    setAmount('');
    setComments('');
    setSelectedRequest(null);
    setModalVisible(true);
  };

  const openEditModal = (request) => {
    if (!canEdit(request)) {
      Alert.alert('Edit Disabled', 'You can only edit your pending requests.');
      return;
    }
    setEditMode(true);
    setEditRequestId(request.id);
    setTitle(request.title);
    setCategory(request.category || '');
    setAmount((request.amount || '').toString());
    setComments(request.comments || '');
    setSelectedRequest(null);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !amount.trim()) {
      Alert.alert('Validation', 'Title and Amount are required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Validation', 'Please enter a valid positive Amount.');
        return;
    }

    let error;
    if (editMode) {
      ({ error } = await supabase
        .from('requests')
        .update({ title, category, amount: parsedAmount, comments, updated_at: new Date().toISOString() })
        .eq('id', editRequestId));
    } else {
      ({ error } = await supabase.from('requests').insert([
        {
          title,
          category,
          amount: parsedAmount,
          comments,
          status: 'pending',
          requester_id: profile.id,
          requester_role: profile.role,
        },
      ]));
      if (!error) {
        Alert.alert('Success', 'Request submitted for authorization!');
      }
    }
    if (error) Alert.alert('Error', error.message);
    else {
      setModalVisible(false);
      setTitle('');
      setCategory('');
      setAmount('');
      setComments('');
      setEditRequestId(null);
      setEditMode(false);
      fetchRequests();
    }
  };

  const getStatusColor = (status) => {
    if (status === 'fulfilled' || status === 'proprietor_approved' || status === 'authorized') return colors.primary;
    if (status === 'rejected') return colors.reject;
    if (status === 'approved') return colors.secondary; // Approved, waiting for proprietor
    return colors.secondary; // Pending
  };

  const openRequestModal = (request) => {
    setSelectedRequest(request);
    setAuthComment('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setAuthComment('');
    setModalVisible(false);
    // Also reset form state if it was an edit/add modal
    setEditMode(false);
    setEditRequestId(null);
    setTitle('');
    setCategory('');
    setAmount('');
    setComments('');
  };

  const handleAction = async (requestId, action) => {
    const newStatus = action === 'authorize' ? 'authorized' : 'rejected';
    const { error } = await supabase.from('requests')
      .update({ status: newStatus, authorizer_id: user.id, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (!error) {
      await supabase.from('request_history').insert([{
        request_id: requestId,
        user_id: user.id,
        action: newStatus,
        comment: authComment,
        timestamp: new Date().toISOString(),
      }]);
      Alert.alert('Success', `Request ${newStatus}`);
      setSelectedRequest(null);
      setAuthComment('');
      setModalVisible(false);
      fetchRequests();
    } else {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'authorization' && styles.activeTab]}
            onPress={() => setActiveTab('authorization')}
          >
            <Text style={activeTab === 'authorization' ? styles.activeTabText : styles.tabText}>Authorization Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'myrequests' && styles.activeTab]}
            onPress={() => setActiveTab('myrequests')}
          >
            <Text style={activeTab === 'myrequests' ? styles.activeTabText : styles.tabText}>My Requests</Text>
          </TouchableOpacity>
        </View>

        {/* --- Profile and Search for My Requests Tab --- */}
        {activeTab === 'myrequests' && (
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
                <Text style={styles.profileRole}>Role: {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</Text>
            </View>

            <View style={styles.searchContainer}>
                <Icon name="search" size={22} color={colors.gray} style={styles.searchIcon} />
                <TextInput
                    placeholder="Search my requests"
                    style={styles.search}
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={colors.textGray}
                />
            </View>
          </View>
        )}

        {/* --- List View --- */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={[styles.requestItem, { borderLeftColor: getStatusColor(item.status) }]}>
              {/* Request Item for My Requests Tab (includes edit/delete) */}
              {activeTab === 'myrequests' ? (
                <>
                    <View style={styles.requestHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.detailText}>
                                <Text style={styles.detailLabel}>Category:</Text> {item.category || 'N/A'}
                            </Text>
                            <Text style={[styles.detailText, {marginBottom: 4}]}>
                                <Text style={styles.detailLabel}>Amount:</Text> {formatAmount(item.amount)}
                            </Text>
                            <Text style={styles.statusLine}>
                                Status:{' '}
                                <Text style={{ color: getStatusColor(item.status), fontWeight: '600' }}>
                                    {item.status}
                                </Text>
                            </Text>
                            {item.created_at && <Text style={styles.createdAt}>Created: {formatDate(item.created_at)}</Text>}
                        </View>

                        <View style={styles.iconContainer}>
                            <TouchableOpacity
                                onPress={() => canEdit(item) && openEditModal(item)}
                                disabled={!canEdit(item)}
                                style={!canEdit(item) ? styles.iconBoxDisabled : styles.iconBox}
                            >
                                <Icon name="edit" size={24} color={canEdit(item) ? colors.primary : colors.border} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBox}>
                                <Icon name="delete" size={24} color={colors.reject} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TimelineBar status={item.status} />
                </>
              ) : (
                // Request Item for Authorization Tab (is a TouchableOpacity)
                <TouchableOpacity onPress={() => openRequestModal(item)}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Category:</Text> {item.category || 'N/A'}
                    </Text>
                    <Text style={[styles.detailText, {marginBottom: 4}]}>
                        <Text style={styles.detailLabel}>Amount:</Text> {formatAmount(item.amount)}
                    </Text>
                    <Text style={styles.statusLine}>
                        Status:{' '}
                        <Text style={{ color: getStatusColor(item.status), fontWeight: '600' }}>
                            {item.status}
                        </Text>
                    </Text>
                    <Icon name="chevron-right" size={24} color="#555" style={styles.chevron} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No requests found.</Text>}
        />
      </View>

      {/* Floating Add Button for My Requests */}
      {activeTab === 'myrequests' && (
        <TouchableOpacity style={styles.plusBtn} onPress={openAddModal}>
          <Text style={styles.plusText}>+</Text>
        </TouchableOpacity>
      )}

      {/* --- Modal --- */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            {/* 1. Add/Edit Request Modal */}
            {!selectedRequest ? (
              <>
                <Text style={styles.modalTitle}>{editMode ? 'Edit Request' : 'New Request'}</Text>
                <TextInput placeholder="Title" style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textGray} />
                <TextInput placeholder="Category" style={styles.input} value={category} onChangeText={setCategory} placeholderTextColor={colors.textGray} />
                <TextInput placeholder="Amount (in Rupees)" style={styles.input} value={amount} keyboardType="numeric" onChangeText={setAmount} placeholderTextColor={colors.textGray} />
                <TextInput placeholder="Comments" style={[styles.input, { minHeight: 60 }]} value={comments} onChangeText={setComments} multiline placeholderTextColor={colors.textGray} />

                <View style={styles.buttonsContainer}>
                  <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={handleSubmit}>
                    <Text style={styles.actionButtonText}>{editMode ? 'Update' : 'Submit Request'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={closeModal}>
                    <Text style={[styles.actionButtonText, { color: colors.textDark }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // 2. Authorization Action Modal
              <>
                <Text style={styles.modalTitle}>Review Request: {selectedRequest.title}</Text>
                <View style={styles.modalDetails}>
                    <Text style={styles.modalDetailText}><Text style={styles.modalDetailLabel}>Category:</Text> {selectedRequest.category || 'N/A'}</Text>
                    <Text style={styles.modalDetailText}><Text style={styles.modalDetailLabel}>Amount:</Text> {formatAmount(selectedRequest.amount)}</Text>
                    <Text style={[styles.modalDetailText, { marginBottom: 15 }]}><Text style={styles.modalDetailLabel}>Requester Comments:</Text> {selectedRequest.comments || 'N/A'}</Text>
                </View>

                <TextInput
                  placeholder="Add comments for authorization (optional)"
                  style={styles.commentInput}
                  multiline
                  value={authComment}
                  onChangeText={setAuthComment}
                  placeholderTextColor="#999"
                />

                <View style={styles.buttonsContainer}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.approveButton]} 
                    onPress={() => handleAction(selectedRequest.id, 'authorize')}
                  >
                    <Icon name="check-circle" size={20} color={colors.white} />
                    <Text style={styles.actionButtonText}>Authorize</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.rejectButton]} 
                    onPress={() => handleAction(selectedRequest.id, 'reject')}
                  >
                    <Icon name="cancel" size={20} color={colors.white} />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton, {marginTop: 10}]} onPress={closeModal}>
                    <Text style={[styles.actionButtonText, { color: colors.textDark, marginLeft: 0 }]}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}


// ================= STYLES (Refined and Comprehensive) ==================
const circleSize = 26;

const colors = {
  primary: '#4D8462', // Green
  secondary: '#FFAC16', // Orange/Amber for pending/approving stages
  reject: '#c0392b', // Dark Red
  white: '#FFFFFF',
  background: '#F8F9FA', // Light grey background
  card: '#FFFFFF',
  textDark: '#333333',
  textGray: '#777777', // Default gray text
  gray: '#A0A0A0', // Used for borders/inactive
  border: '#E0E0E0',
};

const styles = StyleSheet.create({
  appContainer: { 
    flex: 1, 
    backgroundColor: colors.background, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  container: { 
    flex: 1,
    paddingHorizontal: 12,
  },
  
  // --- Tabs ---
  tabContainer: { 
    flexDirection: 'row', 
    marginBottom: 20, 
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 6,
    marginHorizontal: 5,
    elevation: 1,
  },
  tab: { 
    flex: 1,
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: { 
    backgroundColor: colors.primary,
  },
  tabText: { 
    fontSize: 15, 
    color: colors.textDark, 
    fontWeight: '500',
  },
  activeTabText: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: colors.white,
  },

  // --- Profile Box ---
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
    paddingVertical: 3,
  },
  profileIcon: {
    marginRight: 8,
    opacity: 0.8,
  },
  profileName: {
    fontWeight: '700',
    fontSize: 18,
    color: colors.textDark,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textGray,
  },
  roleItem: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  profileRole: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },

  // --- Search Bar ---
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 15,
  },
  searchIcon: {
    paddingLeft: 12,
  },
  search: { 
    flex: 1,
    paddingHorizontal: 10, 
    paddingVertical: Platform.OS === 'ios' ? 12 : 10, 
    fontSize: 15,
    color: colors.textDark,
  },

  // --- Request List Item ---
  listContainer: {
    paddingHorizontal: 5,
    paddingBottom: 120, // ensure space for floating button
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
  requestHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: { 
    fontWeight: '700', 
    fontSize: 17,
    color: colors.textDark, 
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
    color: colors.textDark,
  },
  detailText: {
    fontSize: 14,
    color: colors.textDark,
    marginVertical: 1,
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
  iconContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: 5,
  },
  iconBox: { 
    marginLeft: 10, 
    padding: 5,
  },
  iconBoxDisabled: { 
    marginLeft: 10, 
    opacity: 0.5,
    padding: 5,
  },
  emptyText: { 
    marginTop: 60, 
    color: colors.textGray, 
    textAlign: 'center',
    fontSize: 16,
  },

  // --- Floating Button ---
  plusBtn: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    backgroundColor: colors.primary, 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, },
      android: { elevation: 6, },
    }),
  },
  plusText: { 
    color: colors.white, 
    fontSize: 32, 
    lineHeight: 32,
    fontWeight: '300',
  },

  // --- Modals ---
  modalBackground: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  modalContent: { 
    width: '90%',
    maxWidth: 400,
    backgroundColor: colors.white, 
    borderRadius: 16, 
    padding: 24,
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, },
        android: { elevation: 10, },
    }),
  },
  modalTitle: { 
    fontSize: 22, 
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
  input: { 
    borderWidth: 1.5, 
    borderColor: colors.border, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: colors.background,
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
  
  // --- Action Buttons (Standardized) ---
  buttonsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20,
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
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },

  // --- Timeline Styles (Using new color scheme) ---
  timelineRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12, 
    marginBottom: 4, 
    justifyContent: 'flex-start' 
  },
  timelineStepContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  timelineCircle: { 
    width: circleSize, 
    height: circleSize, 
    borderRadius: circleSize / 2, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderColor: colors.gray, 
    borderWidth: 2,
  },
  timelineCheck: { 
    color: colors.white, 
    fontWeight: 'bold', 
    fontSize: 15, 
    backgroundColor: colors.primary, 
    borderRadius: circleSize / 2, 
    width: '100%',
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  timelineDash: { 
    color: colors.secondary, // Use secondary for pending/current
    fontWeight: 'bold', 
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    textAlignVertical: 'center',
  },
  timelineLabel: { 
    marginHorizontal: 2, 
    fontSize: 11, // Slightly smaller font for space
    minWidth: 68, 
    textAlign: 'center',
    paddingTop: 4, // Space below circle
    color: colors.textGray,
  },
  timelineLine: { 
    width: 32, 
    height: 2, 
    backgroundColor: colors.gray, 
    marginHorizontal: -3, 
    marginBottom: 0,
    marginTop: -26, // Align line with center of circles
  },
});
