import 'package:flutter/material.dart';
import '../../utils/app_theme.dart';

class ChatScreen extends StatefulWidget {
  final String userId;

  const ChatScreen({super.key, required this.userId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  // رسائل تجريبية
  final List<Map<String, dynamic>> _messages = [
    {'text': 'السلام عليكم ورحمة الله وبركاته', 'isMe': false, 'time': '10:00'},
    {'text': 'وعليكم السلام ورحمة الله وبركاته', 'isMe': true, 'time': '10:01'},
    {'text': 'جزاكم الله خيراً على التواصل، رأيت ملفكم الشخصي وأعجبني جداً', 'isMe': false, 'time': '10:02'},
    {'text': 'بارك الله فيكم، يسعدني التعارف للزواج الشرعي', 'isMe': true, 'time': '10:03'},
    {'text': 'هل يمكنني التواصل مع ولي الأمر للحديث عن الأمر؟', 'isMe': false, 'time': '10:05'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white24,
              child: Text('👤', style: TextStyle(fontSize: 18)),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('أم عبدالله', style: TextStyle(fontFamily: 'Tajawal', fontSize: 15, color: Colors.white)),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(color: AppTheme.onlineGreen, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 4),
                    Text('متواجدة الآن', style: TextStyle(fontFamily: 'Tajawal', fontSize: 11, color: Colors.white.withOpacity(0.8))),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onSelected: (val) {
              if (val == 'report') {
                _showReportDialog();
              } else if (val == 'block') {
                _showBlockDialog();
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'profile', child: Text('عرض الملف الشخصي', style: TextStyle(fontFamily: 'Tajawal'))),
              const PopupMenuItem(value: 'report', child: Text('الإبلاغ عن مشكلة', style: TextStyle(fontFamily: 'Tajawal'))),
              const PopupMenuItem(value: 'block', child: Text('حظر المستخدم', style: TextStyle(fontFamily: 'Tajawal', color: Colors.red))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Islamic reminder
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: AppTheme.lightGold.withOpacity(0.5),
            child: const Row(
              children: [
                Text('⚠️', style: TextStyle(fontSize: 14)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'اتق الله في محادثتك - ممنوع طلب الأرقام أو البريد الإلكتروني',
                    style: TextStyle(fontFamily: 'Tajawal', fontSize: 11, color: Color(0xFF92400E)),
                  ),
                ),
              ],
            ),
          ),
          // Messages
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) => _buildMessage(_messages[index]),
            ),
          ),
          // Message input
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildMessage(Map<String, dynamic> msg) {
    final isMe = msg['isMe'] as bool;
    return Align(
      alignment: isMe ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? AppTheme.primaryGreen : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isMe ? const Radius.circular(16) : Radius.zero,
            bottomRight: isMe ? Radius.zero : const Radius.circular(16),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              msg['text'],
              style: TextStyle(
                fontFamily: 'Tajawal',
                color: isMe ? Colors.white : AppTheme.textDark,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              msg['time'],
              style: TextStyle(
                fontFamily: 'Tajawal',
                fontSize: 10,
                color: isMe ? Colors.white70 : AppTheme.textGrey,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppTheme.dividerColor)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              maxLines: 3,
              minLines: 1,
              textDirection: TextDirection.rtl,
              decoration: InputDecoration(
                hintText: 'اكتب رسالتك...',
                hintStyle: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide(color: AppTheme.dividerColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide(color: AppTheme.dividerColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: const BorderSide(color: AppTheme.primaryGreen),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                filled: true,
                fillColor: AppTheme.backgroundCream,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _sendMessage,
            child: Container(
              width: 46,
              height: 46,
              decoration: const BoxDecoration(
                color: AppTheme.primaryGreen,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    // التحقق من المحتوى المحظور
    if (_containsForbiddenContent(text)) {
      _showForbiddenDialog();
      return;
    }

    setState(() {
      _messages.add({
        'text': text,
        'isMe': true,
        'time': '${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}',
      });
    });
    _messageController.clear();
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent + 100,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  bool _containsForbiddenContent(String text) {
    // الكشف عن الأرقام والبريد الإلكتروني
    final phoneRegex = RegExp(r'[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}');
    final emailRegex = RegExp(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}');
    return phoneRegex.hasMatch(text) || emailRegex.hasMatch(text);
  }

  void _showForbiddenDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('⚠️ تحذير', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold)),
        content: const Text(
          'ممنوع تبادل أرقام الهاتف أو البريد الإلكتروني داخل التطبيق. يرجى التواصل عبر ولي الأمر عند وصول الاتفاق.',
          style: TextStyle(fontFamily: 'Tajawal', height: 1.6),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('حسناً، فهمت', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }

  void _showReportDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('الإبلاغ', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('ما سبب الإبلاغ؟', style: TextStyle(fontFamily: 'Tajawal')),
            const SizedBox(height: 12),
            ...['سلوك غير لائق', 'انتحال شخصية', 'محتوى مسيء', 'طلب علاقة محرمة', 'أخرى'].map(
              (reason) => ListTile(
                title: Text(reason, style: const TextStyle(fontFamily: 'Tajawal')),
                leading: Radio<String>(value: reason, groupValue: null, onChanged: (v) {}),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Tajawal'))),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('إرسال البلاغ', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }

  void _showBlockDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('حظر المستخدم', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: Colors.red)),
        content: const Text(
          'هل أنت متأكد من حظر هذا المستخدم؟ لن يتمكن من التواصل معك بعد الآن.',
          style: TextStyle(fontFamily: 'Tajawal', height: 1.6),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Tajawal'))),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('حظر', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
