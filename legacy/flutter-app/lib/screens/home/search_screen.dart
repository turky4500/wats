import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../utils/app_theme.dart';
import '../../providers/search_provider.dart';
import '../../widgets/member_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  bool _showFilters = false;
  String _selectedGender = 'female';
  RangeValues _ageRange = const RangeValues(18, 45);
  String _selectedNationality = '';
  String _selectedCountry = '';
  String _selectedMaritalStatus = '';
  String _selectedReligiousLevel = '';
  String _selectedSort = 'lastSeen';

  final List<String> _nationalities = [
    'الكل', 'السعودية', 'الإمارات', 'الكويت', 'البحرين', 'قطر',
    'عُمان', 'مصر', 'الأردن', 'سوريا', 'لبنان', 'العراق',
    'اليمن', 'المغرب', 'الجزائر', 'تونس', 'ليبيا', 'السودان'
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SearchProvider>().search();
    });
  }

  @override
  Widget build(BuildContext context) {
    final search = context.watch<SearchProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('البحث عن شريك الحياة'),
        actions: [
          IconButton(
            icon: Icon(_showFilters ? Icons.tune : Icons.tune_outlined),
            onPressed: () => setState(() => _showFilters = !_showFilters),
          ),
        ],
      ),
      body: Column(
        children: [
          // Gender tabs
          Container(
            color: AppTheme.primaryGreen,
            padding: const EdgeInsets.only(bottom: 12, left: 16, right: 16),
            child: Row(
              children: [
                Expanded(
                  child: _buildGenderTab('أبحث عن زوجة', 'female'),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildGenderTab('أبحث عن زوج', 'male'),
                ),
              ],
            ),
          ),

          // Filters panel
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            height: _showFilters ? null : 0,
            child: SingleChildScrollView(
              child: _showFilters ? _buildFiltersPanel() : const SizedBox(),
            ),
          ),

          // Results count
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'تم العثور على ${search.results.length} عضو',
                  style: const TextStyle(
                    fontFamily: 'Tajawal',
                    color: AppTheme.textGrey,
                    fontSize: 14,
                  ),
                ),
                DropdownButton<String>(
                  value: _selectedSort,
                  underline: const SizedBox(),
                  style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.textDark, fontSize: 13),
                  items: const [
                    DropdownMenuItem(value: 'lastSeen', child: Text('آخر دخول')),
                    DropdownMenuItem(value: 'createdAt', child: Text('الأحدث')),
                    DropdownMenuItem(value: 'age', child: Text('العمر')),
                  ],
                  onChanged: (val) => setState(() => _selectedSort = val!),
                ),
              ],
            ),
          ),

          // Results
          Expanded(
            child: search.isLoading
                ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryGreen))
                : search.results.isEmpty
                    ? _buildEmptyState()
                    : GridView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.72,
                        ),
                        itemCount: search.results.length,
                        itemBuilder: (context, index) => MemberCard(user: search.results[index]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildGenderTab(String label, String value) {
    final isSelected = _selectedGender == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedGender = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Tajawal',
            color: isSelected ? AppTheme.primaryGreen : Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildFiltersPanel() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('فلترة النتائج', style: TextStyle(fontFamily: 'Tajawal', fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textDark)),
          const SizedBox(height: 16),
          // Age range
          const Text('الفئة العمرية:', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textDark, fontWeight: FontWeight.w500)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_ageRange.start.round()} سنة', style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.primaryGreen, fontWeight: FontWeight.bold)),
              Text('${_ageRange.end.round()} سنة', style: const TextStyle(fontFamily: 'Tajawal', color: AppTheme.primaryGreen, fontWeight: FontWeight.bold)),
            ],
          ),
          RangeSlider(
            values: _ageRange,
            min: 18,
            max: 70,
            divisions: 52,
            activeColor: AppTheme.primaryGreen,
            onChanged: (values) => setState(() => _ageRange = values),
          ),
          const SizedBox(height: 12),
          // Nationality
          DropdownButtonFormField<String>(
            value: _selectedNationality.isEmpty ? 'الكل' : _selectedNationality,
            decoration: const InputDecoration(
              labelText: 'الجنسية',
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            items: _nationalities.map((n) => DropdownMenuItem(value: n, child: Text(n, style: const TextStyle(fontFamily: 'Tajawal')))).toList(),
            onChanged: (val) => setState(() => _selectedNationality = val == 'الكل' ? '' : val!),
          ),
          const SizedBox(height: 10),
          // Marital status
          const Text('الحالة الاجتماعية:', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textDark, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              _buildFilterChip('الكل', ''),
              _buildFilterChip('أعزب/عازبة', 'single'),
              _buildFilterChip('مطلق/مطلقة', 'divorced'),
              _buildFilterChip('أرمل/أرملة', 'widowed'),
            ],
          ),
          const SizedBox(height: 10),
          // Religious level
          const Text('درجة الالتزام:', style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textDark, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              _buildReligiousChip('الكل', ''),
              _buildReligiousChip('ملتزم/ة', 'committed'),
              _buildReligiousChip('متوسط', 'moderate'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _resetFilters,
                  child: const Text('إعادة ضبط', style: TextStyle(fontFamily: 'Tajawal')),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    context.read<SearchProvider>().search();
                    setState(() => _showFilters = false);
                  },
                  child: const Text('تطبيق', style: TextStyle(fontFamily: 'Tajawal')),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedMaritalStatus == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedMaritalStatus = value),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryGreen : AppTheme.backgroundCream,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppTheme.primaryGreen : AppTheme.dividerColor),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Tajawal',
            color: isSelected ? Colors.white : AppTheme.textDark,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildReligiousChip(String label, String value) {
    final isSelected = _selectedReligiousLevel == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedReligiousLevel = value),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryGreen : AppTheme.backgroundCream,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppTheme.primaryGreen : AppTheme.dividerColor),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Tajawal',
            color: isSelected ? Colors.white : AppTheme.textDark,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('🔍', style: TextStyle(fontSize: 60)),
          const SizedBox(height: 16),
          const Text(
            'لا توجد نتائج',
            style: TextStyle(fontFamily: 'Tajawal', fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark),
          ),
          const SizedBox(height: 8),
          const Text(
            'جرّب تغيير معايير البحث',
            style: TextStyle(fontFamily: 'Tajawal', color: AppTheme.textGrey),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _resetFilters,
            child: const Text('إعادة ضبط الفلاتر', style: TextStyle(fontFamily: 'Tajawal')),
          ),
        ],
      ),
    );
  }

  void _resetFilters() {
    setState(() {
      _selectedGender = 'female';
      _ageRange = const RangeValues(18, 45);
      _selectedNationality = '';
      _selectedCountry = '';
      _selectedMaritalStatus = '';
      _selectedReligiousLevel = '';
      _showFilters = false;
    });
    context.read<SearchProvider>().search();
  }
}
