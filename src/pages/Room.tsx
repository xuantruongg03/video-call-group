import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useCheckRoomStatus from "@/hooks/use-check-room-status";
import useCheckUsername from "@/hooks/use-check-username";
import useVerifyRoom from "@/hooks/use-verify-room";
import CONSTANT from "@/lib/constant";
import { ArrowRight, CheckCircle, MessageCircle, Shield, UserRound, Video, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import nameDefault from "../lib/name";
import { useDispatch } from "react-redux";
import { PasswordDialog } from "@/components/Dialogs/PasswordRequire";

const Room = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const { isPending, checkUsernameMutation } = useCheckUsername();
  const { checkRoomStatusMutation, isPending: isRoomStatusPending } = useCheckRoomStatus();
  const { verifyRoomMutation, isPending: isVerifyRoomPending } = useVerifyRoom();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [roomPassword, setRoomPassword] = useState("");
  const dispatch = useDispatch();

  const checkUsername = async (userName: string) => {
    const checkUsername = await checkUsernameMutation({ username: userName, roomId: roomId });
    return checkUsername;
  }

  const handleCreateRoom = async () => {
    if (userName.trim() === "") {
      const randomName = nameDefault[Math.floor(Math.random() * nameDefault.length)];
      dispatch({ type: "JOIN_ROOM", payload: { username: randomName } });
    } else {
      dispatch({ type: "JOIN_ROOM", payload: { username: userName } });
    }
    const newRoomId = `${Math.random().toString(36).substring(2, CONSTANT.ROOM_ID_LENGTH)}`;
    navigate(`/room/${newRoomId}`);
  };

  
  const handlePasswordSubmit = (password: string) => {
    setIsPasswordDialogOpen(false);
    setRoomPassword(password);
    handleJoinRoomWithPassword();
  };

  const handleJoinRoomWithPassword = async () => {
    verifyRoomMutation({ roomId: roomId, password: roomPassword }).then((res) => {
      if (res.data.valid) {
        dispatch({ type: "JOIN_ROOM", payload: { username: userName, password: roomPassword, isLocked: true } });
        navigate(`/room/${roomId}`);
      }
    });
  }

  const handleJoinRoom = async () => {
    let isUsernameValid = false;
    if (userName.trim() === "") {
      do {
        const randomName = nameDefault[Math.floor(Math.random() * nameDefault.length)];
        isUsernameValid = await checkUsername(randomName).then((res) => res.data.success);
        if (!isUsernameValid) {
          setUserName(randomName);
        }
      } while (!isUsernameValid);
    } else {
      isUsernameValid = await checkUsername(userName).then((res) => res.data.success);
      if (!isUsernameValid) {
        toast.error("Tên người dùng đã tồn tại trong phòng này! Vui lòng chọn tên khác.");
        return;
      }
    }

    checkRoomStatusMutation({ roomId: roomId }).then((res) => {
      if (res.data.locked) {
        setIsPasswordDialogOpen(true);
      } else {
        dispatch({ type: "JOIN_ROOM", payload: { username: userName } });
        navigate(`/room/${roomId}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-indigo-50 to-purple-50">
      {isPasswordDialogOpen && (
        <PasswordDialog
          isOpen={isPasswordDialogOpen}
          onClose={() => setIsPasswordDialogOpen(false)}
          onSubmit={handlePasswordSubmit}
        />
      )}
      <nav className="container mx-auto py-4 px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Video className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-800">VideoMeet</span>
          </div>
          <Button
            onClick={handleCreateRoom}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            Tạo phòng họp
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="container mx-auto pt-8 md:pt-16 px-4">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center bg-blue-600 text-white rounded-full px-4 py-1 text-sm font-medium mb-6">
              <Zap className="w-4 h-4 mr-1" />
              Giải pháp họp trực tuyến tiên tiến
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 mb-4 leading-tight">
              Kết nối mọi người, mọi nơi
            </h1>
            <p className="text-gray-600 max-w-2xl text-lg md:text-xl mb-8">
              Nền tảng họp trực tuyến chất lượng cao với đầy đủ tính năng, dễ sử dụng và hoàn toàn miễn phí. Không cần tải xuống, hoạt động trực tiếp trên trình duyệt của bạn.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start mb-8">
              <Button
                onClick={handleCreateRoom}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Tạo phòng mới
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-blue-200"
              >
                Xem hướng dẫn
              </Button>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-6 text-sm text-gray-500">
              <div className="flex items-center">
                <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                Bảo mật cao
              </div>
              <div className="flex items-center">
                <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                Miễn phí
              </div>
              <div className="flex items-center">
                <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                HD video
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-purple-200 rounded-full filter blur-xl opacity-70"></div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-200 rounded-full filter blur-xl opacity-70"></div>

              <Card className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-sm shadow-xl border-0 overflow-hidden rounded-2xl">
                <CardContent className="pt-6">
                  <div className="flex flex-col space-y-4">
                    <h3 className="text-lg font-medium text-center text-gray-700 mb-2">Tham gia phòng họp</h3>
                    <div className="relative">
                      <div className="absolute left-3 top-3 text-gray-400">
                        <UserRound size={20} />
                      </div>
                      <Input
                        placeholder="Nhập tên hiển thị"
                        className="pl-10 text-lg h-12 border-2 border-gray-200 focus:outline-blue-400"
                        maxLength={CONSTANT.USER_NAME_MAX_LENGTH}
                        value={userName}
                        onChange={(e) => {
                          setUserName(e.target.value);
                        }}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute left-3 top-3 text-gray-400">
                        <Video size={20} />
                      </div>
                      <Input
                        placeholder="Nhập mã phòng"
                        className="pl-10 text-lg h-12 border-2 border-gray-200 focus:outline-blue-400"
                        maxLength={CONSTANT.ROOM_ID_LENGTH}
                        minLength={CONSTANT.ROOM_ID_LENGTH}
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleJoinRoom}
                      className="h-12 bg-blue-600 hover:bg-blue-700"
                      disabled={isPending || isRoomStatusPending || isVerifyRoomPending || !roomId.trim()}
                    >
                      {isPending || isRoomStatusPending || isVerifyRoomPending ? "Đang tham gia..." : "Tham gia phòng"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-4 text-gray-400">hoặc</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>
                    <Button
                      onClick={handleCreateRoom}
                      variant="outline"
                      className="h-12 border-2 border-blue-200 text-blue-600 hover:text-blue-700"
                    >
                      Tạo phòng mới
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </header>

      {/* Feature Highlights */}
      <section className="container mx-auto py-24 px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Tính năng nổi bật</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Nền tảng họp trực tuyến của chúng tôi cung cấp đầy đủ tính năng, giúp bạn tổ chức các cuộc họp hiệu quả.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white/70 backdrop-blur p-2 overflow-hidden">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-6">
                <Video className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Video chất lượng cao</h3>
              <p className="text-gray-600">
                Hội họp với hình ảnh và âm thanh chất lượng cao, đảm bảo trải nghiệm giao tiếp tốt nhất.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white/70 backdrop-blur p-2 overflow-hidden">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
                <MessageCircle className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Chat trực tuyến</h3>
              <p className="text-gray-600">
                Trao đổi thông tin nhanh chóng qua tính năng chat trong khi vẫn tiếp tục cuộc họp video.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white/70 backdrop-blur p-2 overflow-hidden">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Bảo mật cao</h3>
              <p className="text-gray-600">
                Mã hóa đầu cuối đảm bảo các cuộc trò chuyện của bạn luôn được bảo mật và riêng tư.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gradient-to-r from-blue-500 to-indigo-600 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Cách thức hoạt động</h2>
            <p className="text-blue-100 max-w-2xl mx-auto text-lg">
              Chỉ với vài bước đơn giản, bạn có thể tạo và tham gia các cuộc họp trực tuyến ngay lập tức.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">1</div>
              <h3 className="text-xl font-semibold text-white mb-2">Tạo phòng họp</h3>
              <p className="text-blue-100">
                Nhấn vào nút "Tạo phòng mới" để khởi tạo phòng họp trực tuyến với mã phòng duy nhất.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">2</div>
              <h3 className="text-xl font-semibold text-white mb-2">Chia sẻ mã phòng</h3>
              <p className="text-blue-100">
                Gửi mã phòng họp cho những người bạn muốn mời tham gia qua email, tin nhắn hoặc mạng xã hội.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">3</div>
              <h3 className="text-xl font-semibold text-white mb-2">Bắt đầu họp</h3>
              <p className="text-blue-100">
                Người được mời nhập mã phòng, cho phép camera và microphone, và cuộc họp bắt đầu ngay lập tức.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto py-24 px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-400 rounded-full filter blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-400 rounded-full filter blur-3xl opacity-20 translate-x-1/2 translate-y-1/2"></div>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Sẵn sàng bắt đầu?</h2>
            <p className="text-blue-100 max-w-2xl mx-auto mb-8 text-lg">
              Tham gia cùng hàng nghìn người dùng đang sử dụng nền tảng của chúng tôi cho nhu cầu họp trực tuyến.
            </p>
            <Button
              onClick={handleCreateRoom}
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              Tạo phòng họp đầu tiên
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Video className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-bold text-gray-800">VideoMeet</span>
              </div>
              <p className="text-gray-600 mb-4">
                Nền tảng họp trực tuyến chất lượng cao, dễ sử dụng và hoàn toàn miễn phí.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Sản phẩm</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Tính năng</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Bảo mật</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Doanh nghiệp</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Giáo dục</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Hỗ trợ</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Hướng dẫn</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Câu hỏi thường gặp</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Liên hệ</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Cộng đồng</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Công ty</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Về chúng tôi</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Đối tác</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Tuyển dụng</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-500 text-sm">© 2025 VideoMeet. Tất cả các quyền được bảo lưu.</p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-500 hover:text-blue-600 transition-colors text-sm">
                Điều khoản sử dụng
              </a>
              <a href="#" className="text-gray-500 hover:text-blue-600 transition-colors text-sm">
                Chính sách bảo mật
              </a>
              <a href="#" className="text-gray-500 hover:text-blue-600 transition-colors text-sm">
                Cookie
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Room;
