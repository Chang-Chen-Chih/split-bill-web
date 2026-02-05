// src/FirestoreTest.jsx
import React, { useState } from 'react';
// 1. 引入我們剛剛設定好的 db 實體
import { db } from './firebase'; 
// 2. 引入 Firestore 的操作函式
import { collection, getDocs, addDoc } from 'firebase/firestore';

const FirestoreTest = () => {
  const [users, setUsers] = useState([]);

  // --- 功能 A: 讀取資料 (Read) ---
  const fetchData = async () => {
    try {
      // 指定要讀取 'users' 這個集合
      const querySnapshot = await getDocs(collection(db, "users"));
      
      // 把讀到的資料轉成陣列
      const userList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log("讀取成功！", userList);
      setUsers(userList);
    } catch (error) {
      console.error("讀取失敗:", error);
      alert("讀取失敗，請檢查 Console");
    }
  };

  // --- 功能 B: 寫入資料 (Write) ---
  const addData = async () => {
    try {
      // 在 'users' 集合中新增一筆資料
      const docRef = await addDoc(collection(db, "users"), {
        name: "New Student",
        role: "Developer",
        timestamp: new Date()
      });
      console.log("寫入成功，ID 是: ", docRef.id);
      alert("寫入成功！");
      // 寫入後重新讀取一次，更新畫面
      fetchData();
    } catch (error) {
      console.error("寫入失敗:", error);
      alert("寫入失敗，可能是權限問題");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Firestore 連線測試</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={addData} style={{ marginRight: '10px' }}>
          新增一筆測試資料
        </button>
        <button onClick={fetchData}>
          讀取所有資料
        </button>
      </div>

      <div>
        <h3>資料列表：</h3>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              ID: {user.id} <br/>
              Name: {user.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FirestoreTest;