import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

function App() {
  // --- 狀態管理 ---
  const [transactions, setTransactions] = useState([]); 
  const [loading, setLoading] = useState(true);

  // 輸入欄位狀態 (新增用)
  const [item, setItem] = useState('');       
  const [category, setCategory] = useState(''); 
  const [customCategory, setCustomCategory] = useState(''); 
  const [amount, setAmount] = useState('');   
  const [payer, setPayer] = useState('');         
  const [customPayer, setCustomPayer] = useState(''); 
  const [note, setNote] = useState('');       

  // --- 【修改點 1】編輯模式專用的狀態 ---
  const [editingId, setEditingId] = useState(null); // 目前正在編輯哪一筆 ID
  const [editForm, setEditForm] = useState({        // 編輯中的暫存資料
    item: '', category: '', amount: '', payer: '', note: ''
  });

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
      if (indexA !== indexB) return indexA - indexB; 
      return b.timestamp - a.timestamp; 
    });
  }, [transactions]);

  // --- 4. 分類顏色 ---
  const getCategoryColor = (cat) => {
    switch(cat) {
      case '收入': return { bg: '#ffcdd2', text: '#b71c1c' }; 
      case '喪葬費': return { bg: '#cfd8dc', text: '#455a64' }; 
      case '嘉義支出': return { bg: '#bbdefb', text: '#0d47a1' }; 
      case '雜項': return { bg: '#e1bee7', text: '#4a148c' }; 
      default: return { bg: '#e0e0e0', text: '#555' };       
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

    if (!item || !amount) { alert("請至少輸入「項目」和「金額」！"); return; }
    if (!finalPayer) { alert("請選擇付款人！"); return; }
    if (!finalCategory) { alert("請選擇細項分類！"); return; }

    try {
      await addDoc(collection(db, "expenses"), {
        item, category: finalCategory, amount: parseFloat(amount),
        payer: finalPayer, note, timestamp: new Date(), isPaid: false 
      });
      setItem(''); setCategory(''); setCustomCategory('');
      setAmount(''); setNote(''); setCustomPayer(''); setPayer(''); 
      alert("新增成功！");
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("新增失敗");
    }
  };

  // --- 刪除資料 ---
  const handleDelete = async (id, itemName) => {
    if (window.confirm(`確定要刪除「${itemName}」這筆資料嗎？`)) {
      try { await deleteDoc(doc(db, "expenses", id)); } 
      catch (e) { console.error("刪除失敗:", e); alert("刪除失敗"); }
    }
  };

  // --- 切換付款狀態 ---
  const toggleStatus = async (id, itemName, currentStatus) => {
    if (currentStatus) return;
    const isConfirmed = window.confirm(`${itemName} 這項是否付款？`);
    if (isConfirmed) {
      try {
        const docRef = doc(db, "expenses", id);
        await updateDoc(docRef, { isPaid: true });
      } catch (e) { console.error("更新狀態失敗:", e); alert("更新失敗"); }
    }
  };

  // --- 【修改點 2】編輯相關功能 ---
  // A. 開始編輯：把資料填入 input
  const startEditing = (tx) => {
    setEditingId(tx.id);
    setEditForm({
      item: tx.item,
      category: tx.category,
      amount: tx.amount,
      payer: tx.payer,
      note: tx.note || ''
    });
  };

  // B. 取消編輯
  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ item: '', category: '', amount: '', payer: '', note: '' });
  };

  // C. 儲存編輯
  const saveEdit = async (id) => {
    try {
      const docRef = doc(db, "expenses", id);
      await updateDoc(docRef, {
        item: editForm.item,
        category: editForm.category,
        amount: parseFloat(editForm.amount),
        payer: editForm.payer,
        note: editForm.note
      });
      setEditingId(null); // 關閉編輯模式
    } catch (e) {
      console.error("更新失敗:", e);
      alert("更新資料失敗");
    }
  };

  // --- 匯出 Excel ---
  const handleExport = () => {
    if (transactions.length === 0) { alert("無資料可匯出"); return; }
    const dataToExport = sortedTransactions.map(tx => {
      const isIncome = tx.category === '收入';
      let dateStr = '';
      if (tx.timestamp && tx.timestamp.toDate) {
        dateStr = tx.timestamp.toDate().toLocaleDateString('zh-TW');
      }
      return {
        "日期": dateStr, "項目": tx.item, "分類": tx.category,
        "金額": isIncome ? tx.amount : -tx.amount, 
        "付款人": tx.payer, "備註": tx.note, "狀態": tx.isPaid ? "已付款" : "未付款"
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "收支明細");
    const date = new Date().toISOString().split('T')[0]; 
    XLSX.writeFile(wb, `記帳表_${date}.xlsx`);
  };

  // --- 計算統計 ---
  const stats = useMemo(() => {
    let totalIncome = 0, totalExpense = 0;
    const payerSummary = {};
    transactions.forEach(tx => {
      if (tx.category === '收入') totalIncome += tx.amount;
      else totalExpense += tx.amount;
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
        {/* ...維持原本的新增介面... */}
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
        📝 收支明細 <span style={{fontSize:'0.6em', color:'#888', fontWeight:'normal'}}>(已依照細項排序)</span>
      </h3>
      
      <div style={{ marginBottom: '30px' }}>
        {sortedTransactions.length === 0 && !loading && <p style={{color:'#888', textAlign:'center'}}>目前沒有資料，請新增第一筆！</p>}
        
        {sortedTransactions.map(tx => {
            // 【修改點 3】判斷：如果是編輯中的項目，顯示編輯表單；否則顯示正常卡片
            if (editingId === tx.id) {
              // --- 編輯模式 ---
              return (
                <div key={tx.id} style={{...listItemStyle, border: '2px solid #4CAF50', backgroundColor: '#f0f8f0'}}>
                  <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                    <input 
                      value={editForm.item} 
                      onChange={e => setEditForm({...editForm, item: e.target.value})}
                      placeholder="項目"
                      style={{...inputStyle, flex: 2}} 
                    />
                    <select 
                      value={editForm.category} 
                      onChange={e => setEditForm({...editForm, category: e.target.value})}
                      style={{...inputStyle, flex: 1}}
                    >
                      {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                    <input 
                      type="number" 
                      value={editForm.amount} 
                      onChange={e => setEditForm({...editForm, amount: e.target.value})}
                      placeholder="金額"
                      style={{...inputStyle, flex: 1}} 
                    />
                     <select 
                      value={editForm.payer} 
                      onChange={e => setEditForm({...editForm, payer: e.target.value})}
                      style={{...inputStyle, flex: 1}}
                    >
                      {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div style={{marginBottom:'10px'}}>
                     <input 
                      value={editForm.note} 
                      onChange={e => setEditForm({...editForm, note: e.target.value})}
                      placeholder="備註"
                      style={inputStyle} 
                    />
                  </div>
                  <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
                    <button onClick={cancelEditing} style={{...statusButtonStyle, backgroundColor:'#aaa', color:'white'}}>取消</button>
                    <button onClick={() => saveEdit(tx.id)} style={{...statusButtonStyle, backgroundColor:'#4CAF50', color:'white'}}>儲存修改</button>
                  </div>
                </div>
              );
            } else {
              // --- 正常顯示模式 ---
              const isIncome = tx.category === '收入';
              const sign = isIncome ? '+' : '-';          
              const amountColor = isIncome ? '#e53935' : '#4CAF50'; 
              const tagStyle = getCategoryColor(tx.category);

              return (
                <div key={tx.id} style={listItemStyle}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#333' }}>
                      {tx.item} 
                      <span style={{ 
                        fontSize: '0.7em', color: tagStyle.text, backgroundColor: tagStyle.bg, 
                        padding: '2px 8px', borderRadius: '12px', marginLeft: '8px', 
                        verticalAlign: 'middle', fontWeight: 'bold'
                      }}>
                        {tx.category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ fontWeight: 'bold', color: amountColor, fontSize: '1.2em', marginRight: '5px' }}>
                        {sign} ${tx.amount}
                      </div>
                      
                      {/* 付款狀態 */}
                      <button 
                        onClick={() => toggleStatus(tx.id, tx.item, tx.isPaid)}
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

                      {/* 【修改點 4】新增編輯按鈕 */}
                      <button 
                        onClick={() => startEditing(tx)}
                        style={iconButtonStyle}
                        title="編輯"
                        disabled={tx.isPaid} // 如果已付款，通常建議鎖定不給編輯，若你想開放編輯，把這行拿掉即可
                      >
                        ✎
                      </button>

                      {/* 刪除按鈕 */}
                      <button 
                        onClick={() => handleDelete(tx.id, tx.item)}
                        style={iconButtonStyle}
                        title="刪除"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.95em', color: '#666', borderTop: '1px dashed #eee', paddingTop: '8px' }}>
                    付款人: <span style={{ color: '#007bff', fontWeight: 'bold' }}>{tx.payer}</span>
                    {tx.note && <span style={{ marginLeft: '10px', color: '#999' }}>| 備註: {tx.note}</span>}
                  </div>
                </div>
              );
            }
        })}
      </div>

      {/* 統計區塊 (維持原樣) */}
      <div style={{ backgroundColor: '#333', color: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>📊 總計</h3>
        {Object.keys(stats.payerSummary).length > 0 && (
          <>
             {Object.entries(stats.payerSummary).map(([user, total]) => (
                <div key={user} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9em', color: '#ccc' }}>
                  <span>{user} (經手)</span><span>${total}</span>
                </div>
             ))}
            <hr style={{ borderColor: '#555', margin: '15px 0' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', marginBottom: '5px' }}>
              <span>總收入</span><span style={{ color: '#ef5350', fontWeight: 'bold' }}>+ ${stats.totalIncome}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', marginBottom: '5px' }}>
              <span>總支出</span><span style={{ color: '#66bb6a', fontWeight: 'bold' }}>- ${stats.totalExpense}</span>
            </div>
            <hr style={{ borderColor: '#555', margin: '10px 0' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5em', fontWeight: 'bold' }}>
              <span>結餘</span>
              <span style={{ color: (stats.totalIncome - stats.totalExpense) >= 0 ? '#ef5350' : '#66bb6a' }}>
                $ {stats.totalIncome - stats.totalExpense}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '40px' }}>
        <button onClick={handleExport} style={{backgroundColor: '#008CBA', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '5px', fontSize: '1em', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
          📥 匯出成 Excel 表格
        </button>
      </div>
    </div>
  );
}

// --- 樣式物件 ---
const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc' };
const buttonStyle = { width: '100%', padding: '12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' };
const listItemStyle = { backgroundColor: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '15px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' };
const statusButtonStyle = { border: 'none', borderRadius: '20px', padding: '5px 12px', fontSize: '0.8em', transition: 'background 0.3s', fontWeight: 'bold', minWidth: '70px' };

// 【新增】編輯和刪除小按鈕的共用樣式
const iconButtonStyle = {
  background: 'none', border: '1px solid #ddd', borderRadius: '50%', width: '24px', height: '24px',
  color: '#555', cursor: 'pointer', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '5px'
};

export default App;