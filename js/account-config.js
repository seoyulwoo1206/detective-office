// Appwrite 설정 (계정·기록 저장) — docs/appwrite-설정.md
//
// 이 값은 비밀번호가 아니라 "어느 Appwrite 프로젝트인지" 알려 주는 주소 같은 것이라 공개 저장소에 올라가도 괜찮다.
// 각자의 기록을 지키는 것은 Appwrite 콘솔의 권한 설정(행 단위 보안)이다.
// projectId 를 null 로 두면 로그인 기능이 꺼지고, 기록은 그 브라우저에만 저장된다.
window.DO_ACCOUNT_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
  projectId: 'detective-office',
  databaseId: 'detective',
  tableId: 'saves',
  // 여러 폰 모드(js/room.js)의 표. 콘솔에 rooms·seats 표를 만든 뒤 rooms: true 로 켠다 (docs/appwrite-설정.md)
  rooms: false,
  roomsTable: 'rooms',
  seatsTable: 'seats',
};
