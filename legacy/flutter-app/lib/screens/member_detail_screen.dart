import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../utils/app_theme.dart';
import '../models/user_model.dart';
import '../providers/search_provider.dart';

class MemberDetailScreen extends StatefulWidget {
  final String memberId;

  const MemberDetailScreen({super.key, required this.memberId});

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  bool _isFavorite = false;
  UserModel? _user;

  @override
  void initState() {
    super.initState();
    // في الواقع سيتم جلب البيانات من Firebase
    final results = context.read<SearchProvider>().results;
    try {
      _user = results.firstWhere((u) => u.id == widget.memberId);
    } catch (_) {
      if (results.isNotEmpty) _user = results.first;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_user == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final user = _user!;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: user.gender == 'female'
                            ? [const Color(0xFFE91E8C), const Color(0xFF9C27B0)]
                            : [AppTheme.primaryGreen, const Color(0xFF0D4A28)],
                      ),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 50),
                          Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white24,
                              border: Border.all(color: Colors.white, width: 3),
                            ),
                            child: Center(
                              child: Text(
                                user.gender == 'female' ? '👩' : '👨',
                                style: const TextStyle(fontSize: 60),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            user.username,
                            style: const TextStyle(fontFamily: 'Tajawal', fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (user.isVerified)
                                const Icon(Icons.verified, color: Colors.white, size: 16),
                              const SizedBox(width: 4),
                              Text(
                                '${user.age} سنة • ${user.city}، ${user.country}',
                                style: TextStyle(fontFamily: 'Tajawal', color: Colors.white.withOpacity(0.85), fontSize: 14),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (!user.photoVisible)
                    Container(
                      alignment: const Alignment(0, 0.5),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text('🔒 الصورة خاصة', style: TextStyle(color: Colors.white, fontFamily: 'Tajawal')),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: Icon(_isFavorite ? Icons.favorite : Icons.favorite_border, color: Colors.white),
                onPressed: () => setState(() => _isFavorite = !_isFavorite),
              ),
              IconButton(
                icon: const Icon(Icons.share, color: Colors.white),
                onPressed: () {},
              ),
            ],
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Online status
                  if (user.isOnline)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.onlineGreen.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.onlineGreen.withOpacity(0.3)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(radius: 4, backgroundColor: AppTheme.onlineGreen),
                          SizedBox(width: 8),
                          Text('متواجد الآن', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.onlineGreen, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),

                  // Bio
                  _buildSection(
                    title: 'نبذة عني',
                    icon: '📝',
                    child: Text(user.bio, style: const TextStyle(fontFamily: 'Tajawal', height: 1.7, color: AppTheme.textDark, fontSize: 14)),
                  ),
                  const SizedBox(height: 12),

                  // Info grid
                  _buildSection(
                    title: 'المعلومات الشخصية',
                    icon: '👤',
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(child: _buildInfoItem('العمر', '${user.age} سنة')),
                            Expanded(child: _buildInfoItem('الجنسية', user.nationality)),
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(child: _buildInfoItem('الإقامة', user.country)),
                            Expanded(child: _buildInfoItem('الحالة', user.maritalStatusAr)),
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(child: _buildInfoItem('التعليم', user.education)),
                            Expanded(child: _buildInfoItem('المهنة', user.job)),
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(child: _buildInfoItem('الطول', '${user.height.round()} سم')),
                            Expanded(child: _buildInfoItem('الوزن', '${user.weight.round()} كغ')),
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(child: _buildInfoItem('الالتزام', user.religiousLevelAr)),
                            if (user.gender == 'female' && user.hijab != null)
                              Expanded(child: _buildInfoItem('الحجاب', _hijabLabel(user.hijab!))),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Seeking
                  _buildSection(
                    title: 'ما أبحث عنه',
                    icon: '💑',
                    child: Text(user.seekingDescription, style: const TextStyle(fontFamily: 'Tajawal', height: 1.7, color: AppTheme.textDark, fontSize: 14)),
                  ),
                  const SizedBox(height: 24),

                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => setState(() => _isFavorite = !_isFavorite),
                          icon: Icon(_isFavorite ? Icons.favorite : Icons.favorite_border, color: Colors.red),
                          label: Text(_isFavorite ? 'في المفضلة' : 'أضف للمفضلة', style: const TextStyle(fontFamily: 'Tajawal')),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.red),
                            foregroundColor: Colors.red,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _showMessageDialog(context, user),
                          icon: const Icon(Icons.message_outlined),
                          label: const Text('راسل', style: TextStyle(fontFamily: 'Tajawal')),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Islamic reminder
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryGreen.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.primaryGreen.withOpacity(0.2)),
                    ),
                    child: const Row(
                      children: [
                        Text('🕌', style: TextStyle(fontSize: 20)),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'تذكر أن كل كلمة تكتبها مسجلة. اتق الله وأحسن في تعاملك.',
                            style: TextStyle(fontFamily: 'Tajawal', fontSize: 12, color: AppTheme.primaryGreen, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({required String title, required String icon, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(icon, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textDark)),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppTheme.dividerColor),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildInfoItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, color: AppTheme.textDark, fontSize: 14)),
        ],
      ),
    );
  }

  String _hijabLabel(String hijab) {
    switch (hijab) {
      case 'niqab': return 'نقاب';
      case 'hijab': return 'حجاب';
      case 'none': return 'غير محجبة';
      default: return hijab;
    }
  }

  void _showMessageDialog(BuildContext context, UserModel user) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppTheme.dividerColor, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            const Text('📨 إرسال رسالة', style: TextStyle(fontFamily: 'Tajawal', fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
            const SizedBox(height: 8),
            Text(
              'ستُرسل رسالة لـ ${user.username}\nتأكد أن رسالتك محتشمة وتهدف للزواج الشرعي',
              textAlign: TextAlign.center,
              style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, height: 1.5),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/chat/${user.id}');
                },
                child: const Text('ابدأ المحادثة', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                '⚠️ ممنوع تبادل أرقام الهاتف أو الإيميل - المخالفة تؤدي إلى الحظر',
                textAlign: TextAlign.center,
                style: TextStyle(fontFamily: 'Tajawal', fontSize: 12, color: Color(0xFF92400E)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
