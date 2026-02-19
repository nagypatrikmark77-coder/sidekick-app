import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chatService, type ChatMessage } from '@/lib/chat-service';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize, FontWeight, HEADER_PADDING_TOP } from '@/constants/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

const WELCOME_MESSAGE = 'Szia! Én vagyok a Sidekick AI asszisztensed. Miben segíthetek?';

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await chatService.getMessages();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadMessages();
  }, [user, loadMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    try {
      // Save user message
      const userMsg = await chatService.saveMessage('user', text);
      setMessages(prev => [...prev, userMsg]);

      // Send to webhook and get response
      const reply = await chatService.sendToWebhook(text);

      // Save assistant response
      const assistantMsg = await chatService.saveMessage('assistant', reply);
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error in chat
      try {
        const errorMsg = await chatService.saveMessage('assistant', 'Hiba történt, próbáld újra.');
        setMessages(prev => [...prev, errorMsg]);
      } catch {
        Alert.alert('Hiba', 'Nem sikerült elküldeni az üzenetet.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Beszélgetés törlése',
      'Biztosan törölni szeretnéd az összes üzenetet?',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.clearConversation();
              setMessages([]);
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a beszélgetést.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Feather name="cpu" size={16} color={Colors.primary} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.welcomeIcon}>
        <Feather name="cpu" size={48} color={Colors.primary} />
      </View>
      <Text style={styles.welcomeTitle}>Sidekick AI</Text>
      <Text style={styles.welcomeText}>{WELCOME_MESSAGE}</Text>
    </View>
  );

  const renderTypingIndicator = () => (
    <View style={[styles.messageRow]}>
      <View style={styles.botAvatar}>
        <Feather name="cpu" size={16} color={Colors.primary} />
      </View>
      <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
        <Text style={styles.typingText}>Gondolkodom...</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Feather name="cpu" size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>Sidekick AI</Text>
          </View>
        </View>
        <LoadingScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="cpu" size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Sidekick AI</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.headerButton}>
            <Feather name="trash-2" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.messagesListEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={sending ? renderTypingIndicator : null}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Írj egy üzenetet..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!sending}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.textWhite} />
            ) : (
              <Feather name="send" size={20} color={Colors.textWhite} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  messagesListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  welcomeTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.sm,
  },
  welcomeText: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: FontSize.lg,
    color: Colors.textWhite,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.textWhite,
  },
  messageTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  typingBubble: {
    paddingVertical: Spacing.md,
  },
  typingText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textWhite,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
