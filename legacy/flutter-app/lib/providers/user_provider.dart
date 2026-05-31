import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../models/message_model.dart';

class UserProvider extends ChangeNotifier {
  List<UserModel> _newMembers = [];
  List<UserModel> _onlineMembers = [];
  List<ConversationModel> _conversations = [];
  int _unreadMessages = 0;

  List<UserModel> get newMembers => _newMembers;
  List<UserModel> get onlineMembers => _onlineMembers;
  List<ConversationModel> get conversations => _conversations;
  int get unreadMessages => _unreadMessages;

  Future<void> loadHomeData() async {
    await Future.delayed(const Duration(milliseconds: 500));
    // تحميل البيانات من Firebase
    notifyListeners();
  }

  Future<void> loadConversations() async {
    await Future.delayed(const Duration(milliseconds: 500));
    _conversations = [
      ConversationModel(
        id: 'conv1',
        otherUserId: 'u1',
        otherUsername: 'أم عبدالله',
        lastMessage: 'السلام عليكم ورحمة الله',
        lastMessageTime: DateTime.now().subtract(const Duration(minutes: 5)),
        unreadCount: 2,
        isOnline: true,
      ),
      ConversationModel(
        id: 'conv2',
        otherUserId: 'u2',
        otherUsername: 'هدى الكريم',
        lastMessage: 'بارك الله فيك',
        lastMessageTime: DateTime.now().subtract(const Duration(hours: 1)),
        unreadCount: 0,
        isOnline: false,
      ),
    ];
    _unreadMessages = _conversations.fold(0, (sum, c) => sum + c.unreadCount);
    notifyListeners();
  }
}
