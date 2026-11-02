// 사건 001 — 야자 시간의 실종된 수행평가
// 구조 설명은 CLAUDE.md "사건 데이터 구조" 참고.
DO.registerCase({
  "id": "case-001",
  "title": "야자 시간의 실종된 수행평가",
  "category": "학교·학원",
  "intro": "금요일 밤 9시, 2학년 3반 교실에서 수학 수행평가 답안지 뭉치가 사라졌다. 당시 학교에 남아 있던 사람은 다섯 명. 범인은 그중 한 명이다.",
  "culprit": "s3",
  "scene": {
    "name": "2학년 3반 교실",
    "spots": [["🪑", "교탁 서랍"], ["🗄", "사물함 위"], ["🧹", "청소도구함"], ["📏", "칠판 분필 받침"], ["🎒", "뒷자리 책가방"]]
  },
  "suspects": [
    {
      "id": "s1",
      "name": "체육부 차장",
      "profile": "당신은 8시까지 체육관에서 공 정리를 했고, 9시엔 매점 앞에 있었다. 교실엔 안 갔다.",
      "traits": ["gym", "snack", "late"],
      "lies": []
    },
    {
      "id": "s2",
      "name": "도서부",
      "profile": "당신은 9시까지 도서관에서 책 정리를 했다. 도서관 열쇠를 가지고 있다. 교실엔 안 갔다.",
      "traits": ["library", "key", "late"],
      "lies": []
    },
    {
      "id": "s3",
      "name": "수학 동아리 부장",
      "profile": "당신이 범인이다. 9시에 교실에 들어가 답안지를 가져갔다. 하지만 남들에겐 '도서관에 있었다'고 말할 생각이다. 도서관·교실 조건에는 거짓말해도 된다.",
      "traits": ["classroom", "late", "math"],
      "lies": ["classroom", "library"]
    },
    {
      "id": "s4",
      "name": "방송부",
      "profile": "당신은 8시 반에 방송실에서 나왔고, 9시엔 집에 가는 중이었다. 교실 근처 복도를 지나갔다.",
      "traits": ["hallway", "early"],
      "lies": []
    },
    {
      "id": "s5",
      "name": "당직 선생님",
      "profile": "당신은 9시에 교무실에 있었다. 복도에서 발소리를 들었지만 누군지는 못 봤다.",
      "traits": ["office", "late", "heard"],
      "lies": []
    }
  ],
  "conditions": [
    { "tag": "late", "text": "9시 이후에도 학교에 있던 사람 접어" },
    { "tag": "library", "text": "사건 당일 도서관에 간 사람 접어" },
    { "tag": "classroom", "text": "9시 이후 교실에 들어간 사람 접어" },
    { "tag": "hallway", "text": "교실 앞 복도를 지나간 사람 접어" },
    { "tag": "key", "text": "열쇠를 가지고 있는 사람 접어" },
    { "tag": "math", "text": "수학 수행평가를 아직 안 낸 사람 접어" },
    { "tag": "gym", "text": "체육관에 갔던 사람 접어" },
    { "tag": "heard", "text": "9시에 복도 발소리를 들은 사람 접어" }
  ],
  "clues": [
    { "id": "c1", "text": "도서부 증언: 9시에 도서관엔 나 혼자 있었다.", "exposes": "library" },
    { "id": "c2", "text": "교실 문에서 수학 동아리 배지가 발견되었다.", "exposes": "classroom" },
    { "id": "c3", "text": "당직 일지: 9시 05분 2학년 복도에서 발소리.", "exposes": null }
  ]
});
