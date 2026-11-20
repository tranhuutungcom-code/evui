export type Level = {
  id: string; age: string; name: string; range: string; description: string;
  color: string; goal: string; lessons: Lesson[];
}
export type Lesson = {
  id: string; title: string; duration: string; objective: string;
  words: string[]; phrases: string[]; activity: string; type: 'listen'|'speak'|'play'|'story'
}
export const levels: Level[] = [
  {
    id:'L1', age:'3–4 tuổi', name:'Little Explorers', range:'Làm quen với âm thanh tiếng Anh',
    description:'Nghe, nhận biết, vận động và bắt chước những từ thật gần gũi. Không ép trẻ phải nói đúng ngay.',
    color:'peach', goal:'Trẻ vui vẻ nghe tiếng Anh và tự nguyện bắt chước âm thanh, từ đơn giản.',
    lessons:[
      {id:'L1-01',title:'Hello, Goodbye!',duration:'5–7 phút',objective:'Phản ứng với lời chào qua giọng nói và cử chỉ.',words:['Hello','Hi','Goodbye','Bye-bye'],phrases:['Hello!','Goodbye!'],activity:'Chạm vào nhân vật đang nói Hello; vẫy tay khi nghe Goodbye.',type:'listen'},
      {id:'L1-02',title:'My Name Is...',duration:'5–7 phút',objective:'Làm quen cách giới thiệu tên bằng mẫu câu ngắn.',words:['name','I','my'],phrases:['My name is…','I am…'],activity:'Nghe mẫu, chọn nhân vật và thử nói tên của mình.',type:'speak'},
      {id:'L1-03',title:'Red, Blue, Yellow',duration:'5–7 phút',objective:'Nhận biết ba màu cơ bản qua hình ảnh.',words:['red','blue','yellow'],phrases:['Red!','Blue!','Yellow!'],activity:'Tìm đồ vật đúng màu trong khu vườn.',type:'play'},
      {id:'L1-04',title:'My Animal Friends',duration:'5–7 phút',objective:'Nhận biết một số con vật và âm thanh quen thuộc.',words:['cat','dog','bird','fish'],phrases:['A cat!','I see a dog.'],activity:'Nghe âm thanh và chọn con vật tương ứng.',type:'listen'}
    ]
  },
  {
    id:'L2', age:'5–6 tuổi', name:'Little Learners', range:'Giao tiếp quen thuộc',
    description:'Mở rộng từ vựng, chào hỏi, nói về gia đình, sở thích và đồ vật quanh trẻ.',
    color:'yellow', goal:'Trẻ có thể chào hỏi, trả lời câu hỏi đơn giản và nói về điều quen thuộc.',
    lessons:[
      {id:'L2-01',title:'Nice to Meet You',duration:'10–12 phút',objective:'Chào hỏi và làm quen trong tình huống đơn giản.',words:['hello','name','friend','meet'],phrases:['What is your name?','My name is…','Nice to meet you.'],activity:'Ghép câu thoại để hai bạn nhỏ làm quen.',type:'speak'},
      {id:'L2-02',title:'How Are You?',duration:'10–12 phút',objective:'Hỏi và trả lời về cảm xúc cơ bản.',words:['happy','sad','tired','fine'],phrases:['How are you?','I am happy.','I am fine.'],activity:'Chọn khuôn mặt phù hợp với câu nghe được.',type:'play'},
      {id:'L2-03',title:'My Family',duration:'10–12 phút',objective:'Gọi tên các thành viên gia đình.',words:['mother','father','sister','brother'],phrases:['This is my mother.','I love my family.'],activity:'Tạo cây gia đình bằng cách kéo thả hình.',type:'play'},
      {id:'L2-04',title:'What Do You Like?',duration:'10–12 phút',objective:'Nói về món ăn yêu thích.',words:['apple','banana','orange','mango'],phrases:['What do you like?','I like apples.','Yes, I do.'],activity:'Đóng vai gọi món ở quầy trái cây.',type:'speak'}
    ]
  },
  {
    id:'L3', age:'7–9 tuổi', name:'Young Learners', range:'Diễn đạt câu và kể việc hằng ngày',
    description:'Xây dựng câu, nghe hiểu đoạn ngắn, đọc câu đơn giản và kể về lịch sinh hoạt.',
    color:'green', goal:'Trẻ có thể kể về một ngày của mình bằng các câu có trình tự.',
    lessons:[
      {id:'L3-01',title:'All About Me',duration:'15–20 phút',objective:'Giới thiệu bản thân bằng nhiều câu liên kết.',words:['name','age','live','like','school'],phrases:['My name is…','I am eight years old.','I live in…'],activity:'Sắp xếp thẻ để tạo bài giới thiệu ngắn.',type:'speak'},
      {id:'L3-02',title:'My Daily Routine',duration:'15–20 phút',objective:'Kể các hoạt động thường ngày theo trình tự.',words:['wake up','brush my teeth','have breakfast','go to school','do homework','go to bed'],phrases:['I wake up at seven.','Then I have breakfast.','After school, I…'],activity:'Sắp xếp tranh theo lịch một ngày và kể lại.',type:'story'},
      {id:'L3-03',title:'What Time Is It?',duration:'15–20 phút',objective:'Hỏi và nói giờ tròn trong ngữ cảnh sinh hoạt.',words:['o’clock','morning','afternoon','evening'],phrases:['What time is it?','It is seven o’clock.'],activity:'Đặt kim đồng hồ theo câu nghe được.',type:'play'},
      {id:'L3-04',title:'At School',duration:'15–20 phút',objective:'Mô tả lớp học và vị trí đồ vật.',words:['classroom','desk','book','behind','next to'],phrases:['My book is on the desk.','The bag is next to the chair.'],activity:'Nghe chỉ dẫn và tìm đồ vật trong lớp học.',type:'listen'}
    ]
  },
  {
    id:'L4', age:'10–11 tuổi', name:'Junior English', range:'Hội thoại và diễn đạt suy nghĩ',
    description:'Thực hành hội thoại theo tình huống, giải thích lựa chọn và trình bày ý kiến ngắn.',
    color:'purple', goal:'Trẻ có thể duy trì hội thoại phù hợp lứa tuổi và diễn đạt ý kiến bằng tiếng Anh.',
    lessons:[
      {id:'L4-01',title:'Introducing Myself',duration:'20–25 phút',objective:'Giới thiệu bản thân có cấu trúc và chi tiết cá nhân phù hợp.',words:['hometown','hobby','usually','because'],phrases:['I would describe myself as…','In my free time, I…','I enjoy… because…'],activity:'Ghi âm bài giới thiệu 45–60 giây.',type:'speak'},
      {id:'L4-02',title:'My Last Weekend',duration:'20–25 phút',objective:'Kể lại sự kiện đã xảy ra bằng quá khứ đơn cơ bản.',words:['visited','played','watched','went','saw'],phrases:['Last weekend, I…','It was exciting because…'],activity:'Kể chuyện cuối tuần theo 4 tranh gợi ý.',type:'story'},
      {id:'L4-03',title:'At the Restaurant',duration:'20–25 phút',objective:'Gọi món lịch sự và hỏi thông tin trong nhà hàng.',words:['menu','order','delicious','bill','drink'],phrases:['Could I see the menu, please?','I would like…','Could we have the bill?'],activity:'Đóng vai khách hàng và nhân viên phục vụ.',type:'speak'},
      {id:'L4-04',title:'Share Your Opinion',duration:'20–25 phút',objective:'Nêu ý kiến và đưa ra một lý do đơn giản.',words:['opinion','prefer','think','reason','agree'],phrases:['I think…','I prefer… because…','I agree with you, but…'],activity:'Chọn chủ đề gần gũi và trao đổi hai lượt.',type:'speak'}
    ]
  }
]
