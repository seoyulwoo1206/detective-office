// 사건 003 — 수학여행 버스, 비어 버린 간식 상자
DO.registerCase({
  "id": "case-003",
  "title": "수학여행 버스, 비어 버린 간식 상자",
  "intro": "수학여행 첫날 밤 11시, 숙소 1층 로비에 두었던 반 전체 간식 상자가 텅 비었다. 그 시간 로비 근처를 오간 사람은 여섯 명. 범인은 그중 한 명이다.",
  "culprit": "s2",
  "suspects": [
    {
      "id": "s1",
      "name": "반장",
      "profile": "당신은 10시 반에 점호를 끝내고 선생님 방에 보고하러 갔다. 11시엔 2층 방에 있었다. 로비엔 안 내려갔다.",
      "traits": ["teacher_room", "upstairs"],
      "lies": []
    },
    {
      "id": "s2",
      "name": "전교 1등",
      "profile": "당신이 범인이다. 배가 너무 고파서 11시에 로비에 내려가 간식을 몽땅 가져와 방 친구들과 나눠 먹었다. 남들에겐 '편의점에 다녀왔다'고 말할 생각이다. 로비·편의점 조건에는 거짓말해도 된다.",
      "traits": ["lobby", "ate", "late"],
      "lies": ["lobby", "store"]
    },
    {
      "id": "s3",
      "name": "체육부 차장",
      "profile": "당신은 11시에 숙소 앞 편의점에 다녀왔다. 편의점엔 당신 말고 아무도 없었다. 돌아오는 길에 로비를 스쳐 지나갔다.",
      "traits": ["store", "lobby_pass", "late"],
      "lies": []
    },
    {
      "id": "s4",
      "name": "방송부",
      "profile": "당신은 10시부터 11시 반까지 1층 세탁실에서 빨래를 했다. 세탁실은 로비 바로 옆이라 누가 지나가는 발소리를 들었다.",
      "traits": ["laundry", "heard", "late"],
      "lies": []
    },
    {
      "id": "s5",
      "name": "담임 선생님",
      "profile": "당신은 11시에 선생님 방에서 내일 일정을 정리했다. 반장이 보고하러 왔다. 로비 CCTV가 고장 났다는 걸 알고 있다.",
      "traits": ["teacher_room", "cctv", "late"],
      "lies": []
    },
    {
      "id": "s6",
      "name": "전학생",
      "profile": "당신은 10시 반에 로비에서 간식 상자가 가득 찬 걸 보고 사진을 찍었다. 그 뒤 바로 방에 올라가 잠들었다.",
      "traits": ["lobby_early", "photo", "upstairs"],
      "lies": []
    }
  ],
  "conditions": [
    { "tag": "lobby", "text": "11시에 로비에 들어간 사람 접어" },
    { "tag": "store", "text": "밤에 편의점에 다녀온 사람 접어" },
    { "tag": "late", "text": "11시 넘어서까지 안 자고 있던 사람 접어" },
    { "tag": "teacher_room", "text": "선생님 방에 갔던 사람 접어" },
    { "tag": "upstairs", "text": "11시에 2층 방에 있던 사람 접어" },
    { "tag": "heard", "text": "로비 쪽 발소리를 들은 사람 접어" },
    { "tag": "photo", "text": "간식 상자 사진을 찍은 사람 접어" },
    { "tag": "ate", "text": "밤에 간식을 먹은 사람 접어" },
    { "tag": "cctv", "text": "로비 CCTV가 고장 난 걸 아는 사람 접어" }
  ],
  "clues": [
    { "id": "c1", "text": "체육부 차장 증언: 11시에 편의점엔 나 혼자였다. 다른 학생은 못 봤다.", "exposes": "store" },
    { "id": "c2", "text": "로비 바닥에서 수학 문제집 쪽지가 발견되었다. 글씨가 아주 또박또박하다.", "exposes": "lobby" },
    { "id": "c3", "text": "전학생이 찍은 10시 반 사진: 간식 상자는 가득 차 있었다.", "exposes": null }
  ]
});
