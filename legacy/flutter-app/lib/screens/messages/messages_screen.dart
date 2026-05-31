import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../utils/app_theme.dart';
import '../../providers/user_provider.dart';
import '../../models/message_model.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<UserProvider>().loadConversations();
    });
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<UserProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('الرسائل'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        ],
      ),
      body: userProvider.conversations.isEmpty
          ? _buildEmptyState()
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: AppTheme.primaryGreen.withOpacity(0.05),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, color: AppTheme.primaryGreen, size: 16),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'ممنوع تبادل الأرقام أو التواصل خارج التطبيق - اتق الله في أمرك',
                          style: TextStyle(fontFamily: 'Tajawal', fontSize: 12, color: AppTheme.primaryGreen),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    itemCount: userProvider.conversations.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: AppTheme.dividerColor),
                    itemBuilder: (context, index) =>
                        _buildConversationTile(userProvider.conversations[index]),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildConversationTile(ConversationModel conv) {
    final now = DateTime.now();
    final diff = now.difference(conv.lastMessageTime);
    String timeAgo;
    if (diff.inMinutes < 60) {
      timeAgo = 'منذ ${diff.inMinutes} د';
    } else if (diff.inHours < 24) {
      timeAgo = 'منذ ${diff.inHours} س';
    } else {
      timeAgo = '${conv.lastMessageTime.day}/${conv.lastMessageTime.month}';
    }

    return InkWell(
      onTap: () => context.push('/chat/${conv.otherUserId}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppTheme.primaryGreen.withOpacity(0.1),
                  child: const Text('👤', style: TextStyle(fontSize: 24)),
                ),
                if (conv.isOnline)
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: AppTheme.onlineGreen,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        conv.otherUsername,
                        style: TextStyle(
                          fontFamily: 'Tajawal',
                          fontWeight: conv.unreadCount > 0 ? FontWeight.bold : FontWeight.normal,
                          fontSize: 15,
                          color: AppTheme.textDark,
                        ),
                      ),
                      Text(timeAgo,
                          style: TextStyle(
                            fontFamily: 'Tajawal',
                            fontSize: 12,
                            color: conv.unreadCount > 0 ? AppTheme.primaryGreen : AppTheme.textGrey,
                          )),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          conv.lastMessage,
                          style: TextStyle(
                            fontFamily: 'Tajawal',
                            fontSize: 13,
                            color: conv.unreadCount > 0 ? AppTheme.textDark : AppTheme.textGrey,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (conv.unreadCount > 0)
                        Container(
                          margin: const EdgeInsets.only(right: 8),
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: AppTheme.primaryGreen,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text('${conv.unreadCount}',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('💬', style: TextStyle(fontSize: 70)),
          const SizedBox(height: 20),
          const Text('لا توجد محادثات بعد',
              style: TextStyle(fontFamily: 'Tajawal', fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
          const SizedBox(height: 8),
          const Text('ابدأ بتصفح الملفات وأرسل رسالة للتعارف الشرعي',
              style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey), textAlign: TextAlign.center),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.search),
            label: const Text('تصفح الأعضاء', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }
}
