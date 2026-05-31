import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../utils/app_theme.dart';
import '../../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;

    if (user == null) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      backgroundColor: AppTheme.backgroundCream,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppTheme.primaryGreen, Color(0xFF0D4A28)],
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 60),
                    Stack(
                      children: [
                        CircleAvatar(
                          radius: 50,
                          backgroundColor: Colors.white24,
                          child: Text(
                            user.gender == 'female' ? '👩' : '👨',
                            style: const TextStyle(fontSize: 50),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: AppTheme.accentGold,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt, color: Colors.white, size: 16),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      user.username,
                      style: const TextStyle(
                        fontFamily: 'Tajawal',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      '${user.age} سنة • ${user.city}، ${user.country}',
                      style: TextStyle(
                        fontFamily: 'Tajawal',
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            title: const Text('ملفي الشخصي'),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit, color: Colors.white),
                onPressed: () {},
              ),
            ],
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Status badges
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (user.isVerified)
                        _buildBadge('✓ موثّق', AppTheme.primaryGreen),
                      const SizedBox(width: 8),
                      _buildBadge(
                        user.premiumType == 'free' ? 'مجاني' : '⭐ ${user.premiumType}',
                        user.premiumType == 'free' ? AppTheme.textGrey : AppTheme.accentGold,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Subscription upgrade card
                  if (!user.isPremium)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFD4AF37), Color(0xFFB8860B)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('⭐ ترقية للعضوية المميزة', style: TextStyle(fontFamily: 'Tajawal', color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                                SizedBox(height: 4),
                                Text('ظهور مميز • دخول متخفٍ • مزيد من الخصائص', style: TextStyle(fontFamily: 'Tajawal', color: Colors.white70, fontSize: 12)),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: () => context.go('/subscription'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFFB8860B),
                            ),
                            child: const Text('ترقية', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),

                  // Bio
                  _buildInfoCard(
                    title: 'نبذة عني',
                    icon: Icons.person_outline,
                    child: Text(
                      user.bio.isEmpty ? 'لم تتم إضافة نبذة بعد' : user.bio,
                      style: const TextStyle(fontFamily: 'Tajawal', height: 1.6, color: AppTheme.textDark),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Personal info
                  _buildInfoCard(
                    title: 'المعلومات الشخصية',
                    icon: Icons.info_outline,
                    child: Column(
                      children: [
                        _buildInfoRow('العمر', '${user.age} سنة', '🎂'),
                        _buildInfoRow('الجنسية', user.nationality, '🌍'),
                        _buildInfoRow('الإقامة', '${user.city}، ${user.country}', '📍'),
                        _buildInfoRow('الحالة', user.maritalStatusAr, '💍'),
                        _buildInfoRow('التعليم', user.education, '🎓'),
                        _buildInfoRow('المهنة', user.job, '💼'),
                        _buildInfoRow('الالتزام الديني', user.religiousLevelAr, '🕌'),
                        if (user.gender == 'male' && user.beard != null)
                          _buildInfoRow('اللحية', user.beard == 'yes' ? 'نعم' : 'لا', '🧔'),
                        if (user.gender == 'female' && user.hijab != null)
                          _buildInfoRow('الحجاب', _hijabLabel(user.hijab!), '🧕'),
                        _buildInfoRow('الطول', '${user.height.round()} سم', '📏'),
                        _buildInfoRow('الوزن', '${user.weight.round()} كغ', '⚖️'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Seeking section
                  _buildInfoCard(
                    title: 'ما أبحث عنه',
                    icon: Icons.favorite_border,
                    child: Text(
                      user.seekingDescription.isEmpty ? 'لم يتم تحديد بعد' : user.seekingDescription,
                      style: const TextStyle(fontFamily: 'Tajawal', height: 1.6, color: AppTheme.textDark),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Settings options
                  _buildSettingsSection(context, auth),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        text,
        style: TextStyle(fontFamily: 'Tajawal', color: color, fontWeight: FontWeight.bold, fontSize: 13),
      ),
    );
  }

  Widget _buildInfoCard({required String title, required IconData icon, required Widget child}) {
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
              Icon(icon, color: AppTheme.primaryGreen, size: 20),
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

  Widget _buildInfoRow(String label, String value, String emoji) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Text('$label:', style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey, fontSize: 14)),
          const Spacer(),
          Text(value, style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textDark, fontWeight: FontWeight.w500, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(BuildContext context, AuthProvider auth) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8),
        ],
      ),
      child: Column(
        children: [
          _buildSettingsTile(Icons.edit, 'تعديل الملف الشخصي', () {}),
          _buildDivider(),
          _buildSettingsTile(Icons.notifications_outlined, 'الإشعارات', () {}),
          _buildDivider(),
          _buildSettingsTile(Icons.lock_outline, 'تغيير كلمة المرور', () {}),
          _buildDivider(),
          _buildSettingsTile(Icons.shield_outlined, 'الخصوصية والأمان', () {}),
          _buildDivider(),
          _buildSettingsTile(Icons.help_outline, 'المساعدة والدعم', () {}),
          _buildDivider(),
          _buildSettingsTile(Icons.info_outline, 'عن التطبيق', () {}),
          _buildDivider(),
          _buildSettingsTile(
            Icons.logout,
            'تسجيل الخروج',
            () => _showLogoutDialog(context, auth),
            isDestructive: true,
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTile(IconData icon, String title, VoidCallback onTap, {bool isDestructive = false}) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: isDestructive ? Colors.red : AppTheme.primaryGreen, size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontFamily: 'Tajawal',
                  fontSize: 15,
                  color: isDestructive ? Colors.red : AppTheme.textDark,
                ),
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.textGrey),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() => const Divider(height: 1, indent: 54, color: AppTheme.dividerColor);

  String _hijabLabel(String hijab) {
    switch (hijab) {
      case 'niqab': return 'نقاب';
      case 'hijab': return 'حجاب';
      case 'none': return 'غير محجبة';
      default: return hijab;
    }
  }

  void _showLogoutDialog(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('تسجيل الخروج', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold)),
        content: const Text('هل أنت متأكد من تسجيل الخروج؟', style: TextStyle(fontFamily: 'Tajawal')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Tajawal'))),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              auth.logout();
              context.go('/login');
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('خروج', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }
}
