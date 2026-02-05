import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';

function App() {
  // --- 狀態管理 ---
  const [transactions, setTransactions] = useState([]); 
  const [loading, setLoading] = useState(true);

  // 輸入欄位狀態
  const [item, setItem] = useState('');       
  const [unit, setUnit] = useState('');       
  const [amount, setAmount] = useState('');   
  
  const [payer, setPayer] = useState('');         
  const [customPayer, setCustomPayer] = useState(''); 
  const [note, setNote] = useState('');       

  // 動態計算名單
  const allUsers = useMemo(() => {
    const historicalUsers = transactions.map(t => t.payer);
    return Array.from(new Set(historicalUsers));
  }, [transactions]); 

  // --- 監聽資料庫 ---
  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 新增資料 ---
  const handleAdd = async () => {
    const finalPayer = (payer === 'NEW_PAYER') ? customPayer.trim() : payer;

    if (!item || !amount) {
      alert("請至少輸入「項目」和「金額」！");
      return;
    }
    if (!finalPayer) {
      alert("請選擇或輸入付款人姓名！");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        item,
        unit,
        amount: parseFloat(amount),
        payer: finalPayer,
        note,
        timestamp: new Date(),
        isPaid: false // 預設為未付款
      });

      // 清空輸入框
      setItem('');
      setUnit('');
      setAmount('');
      setNote('');
      setCustomPayer(''); 
      setPayer(''); 
      
      alert("新增成功！");
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("新增失敗");
    }
  };

  // --- 【修改功能】切換付款狀態 (加入鎖定邏輯) ---
  const toggleStatus = async (id, currentStatus) => {
    // 如果已經付款 (currentStatus 為 true)，就直接結束函式，不做任何事
    if (currentStatus) return;

    try {
      const docRef = doc(db, "expenses", id);
      await updateDoc(docRef, {
        isPaid: true // 強制設定為 true，而不是反轉
      });
    } catch (e) {
      console.error("更新狀態失敗:", e);
      alert("更新失敗，請檢查網路");
    }
  };

  // --- 計算總結 ---
  const summary = {};
  transactions.forEach(tx => {
    summary[tx.payer] = (summary[tx.payer] || 0) + tx.amount;
  });

  // --- UI Render ---
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>活動支出紀錄表</h2>
      
      <div style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '20px', backgroundColor: '#f9f9f9', marginBottom: '25px' }}>
        {/* 輸入區塊 (維持原樣) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>項目 *</label>
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="例如: 飲料" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>單位</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="箱/個" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>金額 ($) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>付款人 *</label>
            <select value={payer} onChange={e => setPayer(e.target.value)} style={inputStyle}>
              <option value="" disabled>請選擇...</option>
              {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
              <option value="NEW_PAYER" style={{ fontWeight: 'bold', color: 'blue' }}>+ 自訂付款人...</option>
            </select>
            {payer === 'NEW_PAYER' && (
              <input value={customPayer} onChange={e => setCustomPayer(e.target.value)} placeholder="輸入新姓名" style={{ ...inputStyle, marginTop: '5px', borderColor: '#2196F3', backgroundColor: '#e3f2fd' }} autoFocus />
            )}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>備註</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="補充說明..." style={inputStyle} />
        </div>

        <button onClick={handleAdd} style={buttonStyle}>儲存到雲端</button>
      </div>

      {/* --- 列表區 --- */}
      <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        📝 支出明細 <span style={{fontSize:'0.6em', color:'#888', fontWeight:'normal'}}>(如需刪除請至後台操作)</span>
      </h3>
      
      <div style={{ marginBottom: '30px' }}>
        {transactions.length === 0 && !loading && <p style={{color:'#888', textAlign:'center'}}>目前沒有資料，請新增第一筆！</p>}
        
        {transactions.map(tx => (
            <div key={tx.id} style={listItemStyle}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#333' }}>
                  {tx.item} 
                  {tx.unit && <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '5px', fontWeight: 'normal' }}>({tx.unit})</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontWeight: 'bold', color: '#d9534f', fontSize: '1.2em' }}>
                    ${tx.amount}
                  </div>
                  
                  {/* --- 修改重點：按鈕 --- */}
                  <button 
                    onClick={() => toggleStatus(tx.id, tx.isPaid)}
                    disabled={tx.isPaid} // 這裡加上 disabled 屬性，如果是 true 就不能按
                    style={{
                      ...statusButtonStyle,
                      backgroundColor: tx.isPaid ? '#4CAF50' : '#e0e0e0',
                      color: tx.isPaid ? 'white' : '#555',
                      cursor: tx.isPaid ? 'default' : 'pointer', // 滑鼠樣式改變：如果是已付款，就不顯示手指
                    }}
                  >
                    {tx.isPaid ? '已付款 ✓' : '未付款'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.95em', color: '#666', borderTop: '1px dashed #eee', paddingTop: '8px' }}>
                付款人: <span style={{ color: '#007bff', fontWeight: 'bold' }}>{tx.payer}</span>
                {tx.note && <span style={{ marginLeft: '10px', color: '#999' }}>| 備註: {tx.note}</span>}
              </div>

            </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#333', color: 'white', padding: '20px', borderRadius: '10px' }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>📊 總支出統計</h3>
        {Object.keys(summary).length === 0 ? (
          <p style={{color: '#aaa', fontStyle:'italic'}}>尚無統計資料</p>
        ) : (
          Object.entries(summary).map(([user, total]) => (
            <div key={user} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>{user}</span>
              <span style={{ color: '#4CAF50' }}>${total}</span>
            </div>
          ))
        )}
        
        {Object.keys(summary).length > 0 && (
          <>
            <hr style={{ borderColor: '#555' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2em', fontWeight: 'bold' }}>
              <span>總計</span>
              <span>${Object.values(summary).reduce((a,b)=>a+b, 0)}</span>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// --- 樣式物件 ---
const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc' };
const buttonStyle = { width: '100%', padding: '12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' };
const listItemStyle = { backgroundColor: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '15px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' };

const statusButtonStyle = {
  border: 'none',
  borderRadius: '20px',
  padding: '5px 12px',
  fontSize: '0.8em',
  transition: 'background 0.3s',
  fontWeight: 'bold',
  minWidth: '70px',
  // 注意：這裡移除了 cursor: 'pointer'，改在 JSX 裡面動態控制
};

export default App;