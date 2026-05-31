// نموذج بيانات المستخدم الكامل
class UserModel {
  final String id;
  final String username;
  final String email;
  final String gender; // 'male' | 'female'
  final int age;
  final String nationality;
  final String country;
  final String city;
  final String maritalStatus; // 'single' | 'divorced' | 'widowed' | 'married'
  final String religiousLevel; // 'committed' | 'moderate' | 'basic'
  final String? beard; // للرجال: 'yes' | 'no'
  final String? hijab; // للنساء: 'niqab' | 'hijab' | 'none'
  final double height;
  final double weight;
  final String skinColor;
  final String education;
  final String job;
  final double? salary;
  final bool hasChildren;
  final int childrenCount;
  final bool acceptPolygamy; // للنساء
  final bool wantsPolygamy; // للرجال
  final String tribe; // القبيلة أو العائلة
  final String bio; // نبذة عن النفس
  final String? photoUrl;
  final bool photoVisible; // هل الصورة ظاهرة للجميع
  final String seekingDescription; // ماذا يبحث
  final List<String> hobbies;
  final bool isOnline;
  final DateTime lastSeen;
  final DateTime createdAt;
  final bool isVerified;
  final bool isPremium;
  final String premiumType; // 'free' | 'silver' | 'gold'
  final DateTime? premiumExpiry;
  final bool isApproved; // موافقة الإدارة
  final bool isActive;
  
  // بيانات ولي الأمر (للنساء)
  final String? guardianName;
  final String? guardianPhone;
  final String? guardianRelation;

  UserModel({
    required this.id,
    required this.username,
    required this.email,
    required this.gender,
    required this.age,
    required this.nationality,
    required this.country,
    required this.city,
    required this.maritalStatus,
    required this.religiousLevel,
    this.beard,
    this.hijab,
    required this.height,
    required this.weight,
    required this.skinColor,
    required this.education,
    required this.job,
    this.salary,
    required this.hasChildren,
    required this.childrenCount,
    required this.acceptPolygamy,
    required this.wantsPolygamy,
    required this.tribe,
    required this.bio,
    this.photoUrl,
    required this.photoVisible,
    required this.seekingDescription,
    required this.hobbies,
    required this.isOnline,
    required this.lastSeen,
    required this.createdAt,
    required this.isVerified,
    required this.isPremium,
    required this.premiumType,
    this.premiumExpiry,
    required this.isApproved,
    required this.isActive,
    this.guardianName,
    this.guardianPhone,
    this.guardianRelation,
  });

  // الحالة الاجتماعية بالعربية
  String get maritalStatusAr {
    switch (maritalStatus) {
      case 'single': return gender == 'female' ? 'عازبة' : 'أعزب';
      case 'divorced': return gender == 'female' ? 'مطلقة' : 'مطلق';
      case 'widowed': return gender == 'female' ? 'أرملة' : 'أرمل';
      case 'married': return gender == 'female' ? 'متزوجة' : 'متزوج';
      default: return maritalStatus;
    }
  }

  // المستوى الديني بالعربية
  String get religiousLevelAr {
    switch (religiousLevel) {
      case 'committed': return 'ملتزم/ة';
      case 'moderate': return 'متوسط الالتزام';
      case 'basic': return 'مسلم/ة';
      default: return religiousLevel;
    }
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      id: map['id'] ?? '',
      username: map['username'] ?? '',
      email: map['email'] ?? '',
      gender: map['gender'] ?? 'male',
      age: map['age'] ?? 18,
      nationality: map['nationality'] ?? '',
      country: map['country'] ?? '',
      city: map['city'] ?? '',
      maritalStatus: map['maritalStatus'] ?? 'single',
      religiousLevel: map['religiousLevel'] ?? 'committed',
      beard: map['beard'],
      hijab: map['hijab'],
      height: (map['height'] ?? 170).toDouble(),
      weight: (map['weight'] ?? 70).toDouble(),
      skinColor: map['skinColor'] ?? 'medium',
      education: map['education'] ?? '',
      job: map['job'] ?? '',
      salary: map['salary']?.toDouble(),
      hasChildren: map['hasChildren'] ?? false,
      childrenCount: map['childrenCount'] ?? 0,
      acceptPolygamy: map['acceptPolygamy'] ?? false,
      wantsPolygamy: map['wantsPolygamy'] ?? false,
      tribe: map['tribe'] ?? '',
      bio: map['bio'] ?? '',
      photoUrl: map['photoUrl'],
      photoVisible: map['photoVisible'] ?? false,
      seekingDescription: map['seekingDescription'] ?? '',
      hobbies: List<String>.from(map['hobbies'] ?? []),
      isOnline: map['isOnline'] ?? false,
      lastSeen: DateTime.fromMillisecondsSinceEpoch(map['lastSeen'] ?? 0),
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt'] ?? 0),
      isVerified: map['isVerified'] ?? false,
      isPremium: map['isPremium'] ?? false,
      premiumType: map['premiumType'] ?? 'free',
      premiumExpiry: map['premiumExpiry'] != null
          ? DateTime.fromMillisecondsSinceEpoch(map['premiumExpiry'])
          : null,
      isApproved: map['isApproved'] ?? false,
      isActive: map['isActive'] ?? true,
      guardianName: map['guardianName'],
      guardianPhone: map['guardianPhone'],
      guardianRelation: map['guardianRelation'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'gender': gender,
      'age': age,
      'nationality': nationality,
      'country': country,
      'city': city,
      'maritalStatus': maritalStatus,
      'religiousLevel': religiousLevel,
      'beard': beard,
      'hijab': hijab,
      'height': height,
      'weight': weight,
      'skinColor': skinColor,
      'education': education,
      'job': job,
      'salary': salary,
      'hasChildren': hasChildren,
      'childrenCount': childrenCount,
      'acceptPolygamy': acceptPolygamy,
      'wantsPolygamy': wantsPolygamy,
      'tribe': tribe,
      'bio': bio,
      'photoUrl': photoUrl,
      'photoVisible': photoVisible,
      'seekingDescription': seekingDescription,
      'hobbies': hobbies,
      'isOnline': isOnline,
      'lastSeen': lastSeen.millisecondsSinceEpoch,
      'createdAt': createdAt.millisecondsSinceEpoch,
      'isVerified': isVerified,
      'isPremium': isPremium,
      'premiumType': premiumType,
      'premiumExpiry': premiumExpiry?.millisecondsSinceEpoch,
      'isApproved': isApproved,
      'isActive': isActive,
      'guardianName': guardianName,
      'guardianPhone': guardianPhone,
      'guardianRelation': guardianRelation,
    };
  }
}
