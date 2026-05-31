"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, Paperclip, Smile, Phone, Video, MoreVertical, User } from "lucide-react";

const conversations = [
  { id: 1, name: "أحمد", phone: "+966 50 000 0001", lastMsg: "شكراً لك", time: "10:30 ص", unread: 2, online: true },
  { id: 2, name: "محمد", phone: "+966 55 000 0002", lastMsg: "متى الاجتماع؟", time: "أمس", unread: 0, online: false },
  { id: 3, name: "فريق العمل", phone: "مجموعة", lastMsg: "تم الانتهاء من المشروع", time: "أمس", unread: 5, online: false },
];

const messages = [
  { id: 1, sender: "other", text: "مرحباً، كيف حالك؟", time: "10:25 ص" },
  { id: 2, sender: "me", text: "الحمد لله بخير، وأنت؟", time: "10:26 ص" },
  { id: 3, sender: "other", text: "بخير الحمد لله. أردت الاستفسار عن الخدمة", time: "10:28 ص" },
  { id: 4, sender: "me", text: "تفضل، أنا هنا للمساعدة", time: "10:29 ص" },
  { id: 5, sender: "other", text: "شكراً لك", time: "10:30 ص" },
];

export default function MessagesPage() {
  const [selected, setSelected] = useState(1);
  const [message, setMessage] = useState("");
  const [msgs, setMsgs] = useState(messages);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMsgs(prev => [...prev, { id: prev.length + 1, sender: "me", text: message, time: "الآن" }]);
    setMessage("");
  };

  const conv = conversations.find(c => c.id === selected);

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">الرسائل</h1>
          <p className="text-gray-500 font-tajawal">إدارة المحادثات</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Conversations List */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b">
            <Input placeholder="بحث في المحادثات..." className="border-gray-200">
            </Input>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-14rem)]">
            {conversations.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className={`w-full flex items-center gap-3 p-4 border-b transition ${selected === c.id ? "bg-emerald-50 border-emerald-200" : "hover:bg-gray-50"}`}>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-emerald-600" />
                  </div>
                  {c.online && <div className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />}
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-tajawal text-sm">{c.name}</span>
                    <span className="text-xs text-gray-400 font-tajawal">{c.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-tajawal truncate">{c.lastMsg}</p>
                </div>
                {c.unread > 0 && (
                  <span className="w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center">{c.unread}</span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 p-0 overflow-hidden flex flex-col">
          {conv && (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold font-tajawal">{conv.name}</h3>
                    <p className="text-xs text-gray-500 font-tajawal">{conv.online ? "متصل الآن" : "آخر ظهور قريباً"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm"><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm"><Video className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {msgs.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender === "me" ? "bg-emerald-600 text-white rounded-bl-none" : "bg-white text-gray-800 rounded-br-none shadow-sm"}`}>
                      <p className="text-sm font-tajawal">{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.sender === "me" ? "text-emerald-200" : "text-gray-400"}`}>{msg.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t bg-white flex items-center gap-2">
                <Button variant="ghost" size="sm"><Smile className="w-5 h-5 text-gray-400" /></Button>
                <Button variant="ghost" size="sm"><Paperclip className="w-5 h-5 text-gray-400" /></Button>
                <input
                  className="flex-1 px-4 py-2 border rounded-xl font-tajawal focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  placeholder="اكتب رسالة..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  dir="rtl"
                />
                <Button onClick={sendMessage} size="sm"><Send className="w-4 h-4" /></Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
