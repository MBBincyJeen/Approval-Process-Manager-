import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from './supabaseClient';
import { Colors } from './theme';

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

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', paddingLeft: 8 }}
    >
      <View style={styles.timelineRow}>
        {STATUS_STEPS.map((step, idx) => {
          const finished = idx < stepIdx || idx === stepIdx;
          const isRejectHere = idx === rejectStepIndex;

          const colorDot = isRejected
            ? isRejectHere
              ? 'red'
              : '#fff'
            : finished
            ? '#4D8462'
            : '#fff';

          const borderDot = isRejected
            ? isRejectHere
              ? 'red'
              : '#A0A0A0'
            : finished
            ? '#4D8462'
            : '#A0A0A0';

          const colorLine =
            isRejected && idx === rejectStepIndex - 1
              ? 'red'
              : idx < stepIdx
              ? '#4D8462'
              : '#A0A0A0';

          return (
            <View key={step.key} style={styles.timelineStepContainer}>
              <View
                style={[
                  styles.timelineCircle,
                  { backgroundColor: colorDot, borderColor: borderDot, borderWidth: 2 },
                ]}
              >
                {finished && !isRejected ? (
                  <Text style={styles.timelineCheck}>{'\u2713'}</Text>
                ) : isRejectHere ? (
                  <Text style={[styles.timelineDash, { color: 'red' }]}>✗</Text>
                ) : (
                  <Text style={styles.timelineDash}>–</Text>
                )}
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  {
                    color: isRejected && isRejectHere ? 'red' : finished ? '#4D8462' : '#888',
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

export default function ApproverScreen({ user, profile }) {
  const [activeTab, setActiveTab] = useState('approvalRequests');
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

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [activeTab]);

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
    try {
      if (activeTab === 'approvalRequests') {
        const { data, error } = await supabase
          .from('requests')
          .select('*')
          .or('status.eq.authorized,requester_role.eq.authorizer')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const filteredData = data.filter(
          (r) => !['approved', 'rejected', 'coordinator_approved', 'fulfilled'].includes(r.status)
        );
        setRequests(filteredData);
        setFiltered(filteredData);
      } else {
        const { data, error } = await supabase
          .from('requests')
          .select('*')
          .eq('requester_id', profile.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRequests(data);
        setFiltered(data);
      }
    } catch (error) {
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
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    let error;
    if (editMode) {
      ({ error } = await supabase
        .from('requests')
        .update({ title, category, amount: amount ? parseFloat(amount) : null, comments })
        .eq('id', editRequestId));
    } else {
      ({ error } = await supabase.from('requests').insert([
        {
          title,
          category,
          amount: amount ? parseFloat(amount) : null,
          comments,
          status: 'approved',
          requester_id: profile.id,
          requester_role: profile.role,
        },
      ]));
    }
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Success', editMode ? 'Request updated!' : 'Request added!');
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

  const handleApproval = async (requestId, action) => {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error } = await supabase
      .from('requests')
      .update({
        status: newStatus,
        approver_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    if (!error) {
      await supabase.from('request_history').insert([
        {
          request_id: requestId,
          user_id: user.id,
          action: newStatus,
          comment: authComment,
          timestamp: new Date().toISOString(),
        },
      ]);
      Alert.alert('Success', `Request ${newStatus}`);
      setSelectedRequest(null);
      setAuthComment('');
      setModalVisible(false);
      fetchRequests();
    } else {
      Alert.alert('Error', error.message);
    }
  };
  const openApprovalModal = (request) => {
  setSelectedRequest(request);
  setAuthComment('');
  setModalVisible(true);
};

const closeModal = () => {
  setSelectedRequest(null);
  setAuthComment('');
  setModalVisible(false);
};

  const getStatusColor = (status) => {
  if (status === 'fulfilled') return Colors.primary;  
  if (status === 'rejected') return 'red';           
  return 'orange';
};


  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'approvalRequests' && styles.activeTab]}
            onPress={() => setActiveTab('approvalRequests')}
          >
            <Text style={activeTab === 'approvalRequests' ? styles.activeTabText : styles.tabText}>
              Approval Requests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'myRequests' && styles.activeTab]}
            onPress={() => setActiveTab('myRequests')}
          >
            <Text style={activeTab === 'myRequests' ? styles.activeTabText : styles.tabText}>My Requests</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'myRequests' && (
          <>
            <View style={styles.profileBox}>
              <Text style={styles.profileName}>{profile.full_name}</Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <Text style={styles.profileRole}>Role: {profile.role}</Text>
              <TextInput
                placeholder="Search requests"
                style={styles.search}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.requestItem, { borderColor: getStatusColor(item.status) }]}>
                  <View style={styles.requestHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text>Category: {item.category}</Text>
                      <Text>Amount: {item.amount}</Text>
                      <Text>
                        Status:{' '}
                        <Text style={{ color: getStatusColor(item.status) }}>{item.status}</Text>
                      </Text>
                      {item.created_at && (
                        <Text>Created: {new Date(item.created_at).toLocaleString()}</Text>
                      )}
                    </View>
                    <View style={styles.iconContainer}>
                      <TouchableOpacity
                        onPress={() => canEdit(item) && openEditModal(item)}
                        disabled={!canEdit(item)}
                        style={!canEdit(item) ? styles.iconBoxDisabled : styles.iconBox}
                      >
                        <Icon name="edit" size={22} color={canEdit(item) ? Colors.black : Colors.gray} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBox}>
                        <Icon name="delete" size={22} color={Colors.black} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TimelineBar status={item.status} />
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No requests found.</Text>}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          </>
        )}

        {activeTab === 'approvalRequests' && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.requestItem, { borderLeftWidth: 8, borderColor: getStatusColor(item.status) }]}
                onPress={() => openApprovalModal(item)}
              >
                <Text style={styles.title}>{item.title}</Text>
                <Text>Category: {item.category}</Text>
                <Text>Amount: {item.amount}</Text>
                <Text>
                  Status: <Text style={{ color: getStatusColor(item.status) }}>{item.status}</Text>
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <TouchableOpacity style={styles.plusBtn} onPress={openAddModal}>
        <Text style={styles.plusText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            {!selectedRequest ? (
              <>
                <Text style={styles.modalTitle}>{editMode ? 'Edit Request' : 'New Request'}</Text>
                <TextInput placeholder="Title" style={styles.input} value={title} onChangeText={setTitle} />
                <TextInput placeholder="Category" style={styles.input} value={category} onChangeText={setCategory} />
                <TextInput placeholder="Amount" style={styles.input} value={amount} keyboardType="numeric" onChangeText={setAmount} />
                <TextInput placeholder="Comments" style={[styles.input, { minHeight: 100 }]} value={comments} onChangeText={setComments} multiline />
                <View style={styles.modalButtons}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Button title={editMode ? 'Update' : 'Submit'} onPress={handleSubmit} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Button title="Cancel" color="red" onPress={() => setModalVisible(false)} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{selectedRequest.title}</Text>
                <Text style={{ marginBottom: 4 }}>Category: {selectedRequest.category}</Text>
                <Text style={{ marginBottom: 4 }}>Amount: {selectedRequest.amount}</Text>
                <Text style={{ marginBottom: 16 }}>Comments: {selectedRequest.comments}</Text>
                <TextInput
                  placeholder="Add comments (optional)"
                  style={styles.commentInput}
                  multiline
                  value={authComment}
                  onChangeText={setAuthComment}
                />
                <View style={styles.buttonsContainer}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Button title="Approve" color={Colors.primary} onPress={() => handleApproval(selectedRequest.id, 'approve')} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Button title="Reject" color="red" onPress={() => handleApproval(selectedRequest.id, 'reject')} />
                  </View>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Button title="Close" onPress={() => setModalVisible(false)} color={Colors.gray} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const circleSize = 30; // Slightly larger for visual impact

const styles = StyleSheet.create({
  // General Container and Layout
  container: { 
    flex: 1, 
    backgroundColor: '#F7F9FC', // Light background
    paddingHorizontal: 20, 
    paddingTop: 40 
  },

  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20,
    backgroundColor: Colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    padding: 4,
  },
  tab: { 
    flex: 1,
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0, // Remove original bottom border
  },
  activeTab: { 
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  tabText: { 
    fontSize: 15, 
    color: Colors.gray, 
    fontWeight: '600' 
  },
  activeTabText: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: Colors.white 
  },

  // FAB (Plus Button)
  plusBtn: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    backgroundColor: Colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  plusText: { 
    color: Colors.white, 
    fontSize: 32, 
    fontWeight: '300' // Lighter font weight for a clean look
  },

  // Profile Box
  profileBox: { 
    marginBottom: 20, 
    padding: 24, 
    backgroundColor: Colors.white, 
    borderRadius: 20, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 10, // Adjust margin top from original 40
  },
  profileName: { 
    fontWeight: '800', 
    fontSize: 24, 
    color: Colors.black 
  },
  profileEmail: { 
    marginTop: 2, 
    fontSize: 14, 
    color: Colors.gray 
  },
  profileRole: { 
    marginTop: 8, 
    fontSize: 16, 
    fontWeight: '700', 
    letterSpacing: 0.5, 
    color: Colors.primary 
  },

  // Search Input
  search: { 
    marginTop: 16, 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 10, 
    borderColor: '#D1D5DB', 
    borderWidth: 1, 
    backgroundColor: '#F9FAFB', 
    fontSize: 16,
    color: Colors.black,
  },

  // Request Item Card
  requestItem: { 
    borderWidth: 1, 
    borderLeftWidth: 8, // Thick left border for status indicator
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 15, 
    backgroundColor: Colors.white, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { 
    fontWeight: '800', // Bolder title
    fontSize: 18,
    color: Colors.black,
    marginBottom: 4,
  },
  requestHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' // Align icons/text to the top
  },
  iconContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: -5 // Pull up slightly
  },
  iconBox: { 
    marginLeft: 12, 
    padding: 5, 
    borderRadius: 50,
    backgroundColor: '#F3F4F6', // Light background for icons
  },
  iconBoxDisabled: { 
    marginLeft: 12, 
    opacity: 0.4,
    backgroundColor: '#F3F4F6',
  },

  // Empty List Text
  emptyText: { 
    marginTop: 60, 
    textAlign: 'center', 
    color: Colors.gray, 
    fontSize: 18, 
    fontStyle: 'italic' 
  },

  // Modal (Overhaul for a modern center modal)
  modalBackground: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: '90%', 
    maxWidth: 400,
    backgroundColor: Colors.white, 
    borderRadius: 20, 
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  modalTitle: { 
    fontSize: 24, 
    color: Colors.primary, 
    fontWeight: '900', 
    marginBottom: 20,
    textAlign: 'center',
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    borderRadius: 10, 
    padding: 12, 
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: Colors.black,
  },
  commentInput: { 
    marginTop: 16, 
    padding: 12, 
    borderColor: '#D1D5DB', 
    borderWidth: 1, 
    borderRadius: 10, 
    minHeight: 100, 
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: Colors.black,
  },
  buttonsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginTop: 20, 
    marginBottom: 10,
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20,
  },

  // Timeline (Refining existing structure)
  timelineRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 15, 
    marginBottom: 5, 
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
    alignItems: 'center' 
  },
  timelineCheck: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16, 
    backgroundColor: '#4D8462', // Keep original logic color
    borderRadius: circleSize / 2, 
    textAlign: 'center', 
    lineHeight: circleSize * 0.95, // For better centering
    width: '100%',
    height: '100%',
  },
  timelineDash: { 
    color: '#FFAC16', // Keep original logic color
    fontWeight: 'bold', 
    fontSize: 22,
    lineHeight: 22,
  },
  timelineLabel: { 
    marginHorizontal: 4, 
    fontSize: 10, // Smaller font for less horizontal scroll
    minWidth: 60, 
    textAlign: 'center',
    marginTop: 4, // Separate label slightly
  },
  timelineLine: { 
    width: 30, 
    height: 3, // Slightly thicker line
    borderRadius: 2,
    backgroundColor: '#A0A0A0', 
    marginHorizontal: -5,
    marginBottom: 0, // Reset original margin bottom
  },
});
