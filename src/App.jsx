import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';

function App() {
  // --- 狀態管理 ---
  const [transactions, setTransactions] = useState([]); 
  const [loading, setLoading] = useState(true);

  // 輸入欄位狀態
  const [item, setItem] = useState('');       
  const [category, setCategory] = useState(''); 
  const [customCategory, setCustomCategory] = useState(''); 

  const [amount, setAmount] = useState('');   
  
  const [payer, setPayer] = useState('');         
  const [customPayer, setCustomPayer] = useState(''); 
  const [note, setNote] = useState('');       

  // --- 1. 付款人名單邏輯 ---
  const allUsers = useMemo(() => {
    const historicalUsers = transactions.map(t => t.payer);
    return Array.from(new Set(historicalUsers));
  }, [transactions]); 

  // --- 2. 分類名單邏輯 ---
  const categoryOrder = ['收入', '喪葬費', '嘉義支出', '雜項'];

  const allCategories = useMemo(() => {
    const historicalCategories = transactions.map(t => t.category).filter(c => c);
    return Array.from(new Set([...categoryOrder, ...historicalCategories]));
  }, [transactions]);

  // --- 3. 列表排序邏輯 ---
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const catA = a.category || '';
      const catB = b.category || '';

      let indexA = categoryOrder.indexOf(catA);
      let indexB = categoryOrder.indexOf(catB);

      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;

      if (indexA !== indexB) {
        return indexA - indexB; 
      }
      return b.timestamp - a.timestamp; 
    });
  }, [transactions]);

  // --- 4. 【新增】定義分類顏色 ---
  const getCategoryColor = (cat) => {
    switch(cat) {
      case '收入': return { bg: '#ffcdd2', text: '#b71c1c' }; // 紅色系
      case '喪葬費': return { bg: '#cfd8dc', text: '#455a64' }; // 灰藍色系 (莊重)
      case '嘉義支出': return { bg: '#bbdefb', text: '#0d47a1' }; // 藍色系 (地點)
      case '雜項': return { bg: '#e1bee7', text: '#4a148c' }; // 紫色系 (其他)
      default: return { bg: '#e0e0e0', text: '#555' };       // 預設灰色
    }
  };

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
    const finalCategory = (category === 'NEW_CATEGORY') ? customCategory.trim() : category;

    if (!item || !amount) {
      alert("請至少輸入「項目」和「金額」！");
      return;
    }
    if (!finalPayer) {
      alert("請選擇付款人！");
      return;
    }
    if (!finalCategory) {
      alert("請選擇細項分類！");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        item,
        category: finalCategory,
        amount: parseFloat(amount),
        payer: finalPayer,
        note,
        timestamp: new Date(),
        isPaid: false 
      });

      setItem('');
      setCategory(''); 
      setCustomCategory('');
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

  const toggleStatus = async (id, currentStatus) => {
    if (currentStatus) return;
    try {
      const docRef = doc(db, "expenses", id);
      await updateDoc(docRef, { isPaid: true });
    } catch (e) {
      console.error("更新狀態失敗:", e);
      alert("更新失敗");
    }
  };

  // --- 【修改】計算統計數據 ---
  // 分開計算總收入和總支出
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const payerSummary = {};

    transactions.forEach(tx => {
      const isIncome = tx.category === '收入';
      
      if (isIncome) {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }

      // 依舊統計每個人經手多少錢 (不分收支，純粹紀錄金流)
      // 如果你希望收入不計入「個人代墊」，可以在這裡加判斷
      payerSummary[tx.payer] = (payerSummary[tx.payer] || 0) + tx.amount;
    });

    return { totalIncome, totalExpense, payerSummary };
  }, [transactions]);

  // --- UI Render ---
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>活動支出紀錄表</h2>
      
      {/* 輸入區塊 */}
      <div style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '20px', backgroundColor: '#f9f9f9', marginBottom: '25px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1.5 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>項目 *</label>
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="例如: 飲料" style={inputStyle} />
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>細項分類 *</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              <option value="" disabled>請選擇...</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="NEW_CATEGORY" style={{ fontWeight: 'bold', color: 'blue' }}>+ 自訂細項...</option>
            </select>
            {category === 'NEW_CATEGORY' && (
              <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="輸入新分類" style={{ ...inputStyle, marginTop: '5px', borderColor: '#2196F3', backgroundColor: '#e3f2fd' }} autoFocus />
            )}
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

      {/* 列表區 */}
      <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        📝 支出明細 <span style={{fontSize:'0.6em', color:'#888', fontWeight:'normal'}}>(已依照細項排序)</span>
      </h3>
      
      <div style={{ marginBottom: '30px' }}>
        {sortedTransactions.length === 0 && !loading && <p style={{color:'#888', textAlign:'center'}}>目前沒有資料，請新增第一筆！</p>}
        
        {sortedTransactions.map(tx => {
            const isIncome = tx.category === '收入';
            const sign = isIncome ? '+' : '-';          
            const amountColor = isIncome ? '#e53935' : '#4CAF50'; 
            
            // 【修改點 1】取得對應的分類顏色
            const tagStyle = getCategoryColor(tx.category);

            return (
              <div key={tx.id} style={listItemStyle}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#333' }}>
                    {tx.item} 
                    {/* 分類標籤：套用動態顏色 */}
                    <span style={{ 
                      fontSize: '0.7em', 
                      color: tagStyle.text, 
                      backgroundColor: tagStyle.bg, 
                      padding: '2px 8px', 
                      borderRadius: '12px', // 稍微圓一點比較好看
                      marginLeft: '8px',
                      verticalAlign: 'middle',
                      fontWeight: 'bold'
                    }}>
                      {tx.category}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: amountColor, fontSize: '1.2em' }}>
                      {sign} ${tx.amount}
                    </div>
                    
                    <button 
                      onClick={() => toggleStatus(tx.id, tx.isPaid)}
                      disabled={tx.isPaid}
                      style={{
                        ...statusButtonStyle,
                        backgroundColor: tx.isPaid ? '#4CAF50' : '#e0e0e0',
                        color: tx.isPaid ? 'white' : '#555',
                        cursor: tx.isPaid ? 'default' : 'pointer',
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
            );
        })}
      </div>

      {/* --- 【修改點 2 & 3】全新的統計區塊 --- */}
      <div style={{ backgroundColor: '#333', color: 'white', padding: '20px', borderRadius: '10px' }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>📊 總計</h3>
        
        {/* 個人經手統計 (保留，方便看誰付了錢) */}
        {Object.keys(stats.payerSummary).length === 0 ? (
          <p style={{color: '#aaa', fontStyle:'italic'}}>尚無統計資料</p>
        ) : (
          Object.entries(stats.payerSummary).map(([user, total]) => (
            <div key={user} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9em', color: '#ccc' }}>
              <span>{user} (經手)</span>
              <span>${total}</span>
            </div>
          ))
        )}
        
        {Object.keys(stats.payerSummary).length > 0 && (
          <>
            <hr style={{ borderColor: '#555', margin: '15px 0' }}/>
            
            {/* 總收入 (紅色) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', marginBottom: '5px' }}>
              <span>總收入</span>
              <span style={{ color: '#ef5350', fontWeight: 'bold' }}>+ ${stats.totalIncome}</span>
            </div>

            {/* 總支出 (綠色) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', marginBottom: '5px' }}>
              <span>總支出</span>
              <span style={{ color: '#66bb6a', fontWeight: 'bold' }}>- ${stats.totalExpense}</span>
            </div>

            <hr style={{ borderColor: '#555', margin: '10px 0' }}/>

            {/* 結餘 (收入 - 支出) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5em', fontWeight: 'bold' }}>
              <span>結餘</span>
              {/* 如果是正的顯示紅色，負的顯示綠色 (依照你的視覺邏輯) */}
              <span style={{ color: (stats.totalIncome - stats.totalExpense) >= 0 ? '#ef5350' : '#66bb6a' }}>
                $ {stats.totalIncome - stats.totalExpense}
              </span>
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
};

export default App;