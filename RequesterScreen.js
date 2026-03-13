import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from './supabaseClient';
import { Colors } from './theme'; // Assuming Colors is defined in './theme'

// --- NO LOGIC CHANGES ---
function formatDate(supabaseDate) {
  const d = new Date(supabaseDate);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

export default function RequesterScreen({ user, profile }) {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [commentsMap, setCommentsMap] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editRequestId, setEditRequestId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (requests.length > 0) {
      fetchCommentsForRequests(requests.map((r) => r.id));
    } else {
      setCommentsMap({});
    }
  }, [requests]);

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
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('requester_id', profile.id)
      .order('created_at', { ascending: false });
    if (!error) setRequests(data);
    setFiltered(data ?? []);
  };

  const fetchCommentsForRequests = async (requestIds) => {
    if (requestIds.length === 0) return;
    const { data, error } = await supabase
      .from('request_history')
      .select('user_id, comment, request_id, user:profiles(full_name, role)')
      .in('request_id', requestIds)
      .order('timestamp', { ascending: true });
    if (error) {
      Alert.alert('Error fetching comments', error.message);
      return;
    }
    const map = {};
    data.forEach((c) => {
      if (!map[c.request_id]) map[c.request_id] = [];
      map[c.request_id].push({
        user_name: c.user?.role ? c.user.role.charAt(0).toUpperCase() + c.user.role.slice(1) : 'User',
        comment: c.comment,
      });
    });
    setCommentsMap(map);
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
      Alert.alert('Edit Disabled', 'You can only edit requests that are pending.');
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
        .update({
          title,
          category,
          amount: amount ? parseFloat(amount) : null,
          comments,
        })
        .eq('id', editRequestId));
    } else {
      ({ error } = await supabase.from('requests').insert([
        {
          title,
          category,
          amount: amount ? parseFloat(amount) : null,
          comments,
          status: 'pending',
          requester_id: profile.id,
          requester_role: 'requester',
        },
      ]));
    }
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Success', editMode ? 'Request updated' : 'Request added');
      setModalVisible(false);
      fetchRequests();
      setTitle('');
      setCategory('');
      setAmount('');
      setComments('');
      setEditRequestId(null);
      setEditMode(false);
    }
  };

  const getStatusColor = (status, isRejectedStage = false) => {
    if (isRejectedStage) return 'red';
    if (status === 'fulfilled') return '#4D8462';
    if (status === 'rejected') return 'red';
    return 'orange';
  };
  // --- END NO LOGIC CHANGES ---

  // --- STYLED TIMELINE COMPONENT (SAME LOGIC) ---
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
                    {
                      backgroundColor: colorDot,
                      borderColor: borderDot,
                      borderWidth: 2,
                    },
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
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: colorLine },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }
  // --- END STYLED TIMELINE COMPONENT ---

  // --- STYLED RENDER FUNCTION ---
  return (
    <View style={styles.container}>
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
        <TouchableOpacity style={styles.plusBtn} onPress={openAddModal}>
          <Icon name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* IMPROVED PROFILE BOX */}
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
          <Icon name="work-outline" size={20} color={Colors.primary} style={styles.profileIcon} />
          <Text style={styles.profileRole}>
            {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
          </Text>
        </View>
      </View>
      {/* END IMPROVED PROFILE BOX */}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const expanded = item.id === expandedId;
          const commentsForRequest = commentsMap[item.id] ?? [];
          const isRejectedStage = item.status === 'rejected';
          const statusColor = getStatusColor(item.status, isRejectedStage);

          return (
            <View style={[styles.card, { borderLeftColor: statusColor }]}>
              <View style={styles.cardHeader}>
                <TouchableOpacity
                  style={styles.cardHeaderLeft}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.createdAt}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.statusLine}>
                    Status:{' '}
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {item.status}
                    </Text>
                  </Text>
                </TouchableOpacity>

                <View style={styles.rightIcons}>
                  <TouchableOpacity
                    onPress={() => (canEdit(item) ? openEditModal(item) : null)}
                    style={canEdit(item) ? styles.iconBox : styles.iconBoxDisabled}
                    disabled={!canEdit(item)}
                  >
                    <Icon name="edit" size={20} color={canEdit(item) ? '#333' : '#bbb'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBox}>
                    <Icon name="delete" size={20} color="#c0392b" />
                  </TouchableOpacity>
                </View>
              </View>

              {expanded && (
                <View style={styles.cardContent}>
                  <TimelineBar status={item.status} />
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Category:</Text> {item.category || 'N/A'}
                    </Text>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Amount:</Text> {item.amount ? `$${item.amount}` : 'N/A'}
                    </Text>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Your Comments:</Text> {item.comments || 'N/A'}
                    </Text>
                  </View>

                  {commentsForRequest.filter(c => c.comment && c.comment.trim() !== '').length > 0 && (
                    <View style={styles.commentsContainer}>
                      <Text style={styles.commentsTitle}>Workflow Comments:</Text>
                      {commentsForRequest
                        .filter(c => c.comment && c.comment.trim() !== '')
                        .map((c, idx) => (
                          <View key={idx} style={styles.commentBubble}>
                            <Text style={styles.commentUser}>{c.user_name}:</Text>
                            <Text style={styles.commentBody}>{c.comment}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No requests found.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{editMode ? 'Edit Request' : 'New Request'}</Text>
              <TextInput
                placeholder="Title (required)"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#999"
              />
              <TextInput
                placeholder="Category"
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholderTextColor="#999"
              />
              <TextInput
                placeholder="Amount"
                style={styles.input}
                value={amount}
                keyboardType="numeric"
                onChangeText={setAmount}
                placeholderTextColor="#999"
              />
              <TextInput
                placeholder="Comments"
                style={[styles.input, styles.inputMultiline]}
                value={comments}
                onChangeText={setComments}
                multiline
                placeholderTextColor="#999"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSubmit]}
                  onPress={handleSubmit}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>
                    {editMode ? 'Update' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
// --- END STYLED RENDER FUNCTION ---

// --- STYLESHEET ---
const circleSize = 28;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: Platform.OS === 'ios' ? 50 : 40,
    marginBottom: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    color: '#333',
  },
  plusBtn: {
    marginLeft: 10,
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  // --- IMPROVED PROFILE STYLES START ---
  profileBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginHorizontal: 12,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4D8462', // Accent color
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
        borderColor: '#E0E0E0',
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
    color: '#333',
  },
  profileEmail: {
    fontSize: 16,
    color: '#555',
  },
  roleItem: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    marginTop: 5,
  },
  profileRole: {
    fontWeight: '700',
    fontSize: 16,
    color: '#4D8462',
  },
  // --- IMPROVED PROFILE STYLES END ---

  listContainer: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  card: {
    borderLeftWidth: 5,
    borderRadius: 12,
    marginVertical: 8,
    padding: 16,
    backgroundColor: Colors.white,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 18,
    color: '#222',
  },
  createdAt: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
  statusLine: {
    marginTop: 6,
    fontSize: 15,
    color: '#444',
  },
  statusText: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconBox: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F1F1',
  },
  iconBoxDisabled: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F1F1',
    opacity: 0.6,
  },
  cardContent: {
    paddingTop: 8,
  },
  detailsContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  detailText: {
    fontSize: 15,
    color: '#444',
    marginVertical: 3,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#111',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    justifyContent: 'flex-start',
  },
  timelineStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineCircle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineCheck: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    backgroundColor: '#4D8462',
    borderRadius: circleSize / 2,
    textAlign: 'center',
    lineHeight: circleSize,
    width: circleSize,
    height: circleSize,
  },
  timelineDash: {
    color: '#A0A0A0',
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: circleSize,
  },
  timelineLabel: {
    marginHorizontal: 4,
    fontSize: 11,
    minWidth: 70,
    textAlign: 'center',
    fontWeight: '500',
  },
  timelineLine: {
    width: 35,
    height: 2,
    backgroundColor: '#A0A0A0',
    marginHorizontal: -3,
    marginBottom: -12,
  },
  commentsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  commentsTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  commentBubble: {
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  commentUser: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 14,
    marginBottom: 2,
  },
  commentBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  emptyText: {
    marginTop: 60,
    textAlign: 'center',
    color: Colors.gray,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
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
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F3F3',
  },
  modalButtonSubmit: {
    backgroundColor: Colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextCancel: {
    color: '#555',
  },
  modalButtonTextSubmit: {
    color: Colors.white,
  },
});