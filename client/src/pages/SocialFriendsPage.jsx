import React, { useState, useEffect } from 'react';
import { Users, Search, Swords, UserPlus, Check, Flame } from 'lucide-react';

export const SocialFriendsPage = ({ token, onChallengeFriend }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/social/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFriends(data.friends || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/social/search-users?query=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 flex items-center justify-center text-blue-400 border border-blue-500/40">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">ASPIRANT FRIENDS & STUDY ROOMS</h1>
            <p className="text-xs text-slate-400">Search fellow competitive exam aspirants, challenge friends to 1v1 battles, and join study rooms.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Search Users */}
        <div className="glass-panel p-5 rounded-xl border border-slate-700/80 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" /> Find Friends
          </h2>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by student name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 glass-input text-xs"
            />
            <button type="submit" className="py-2 px-4 rounded-lg bg-blue-600 text-white font-bold text-xs">
              Search
            </button>
          </form>

          <div className="space-y-2">
            {searchResults.map(u => (
              <div key={u._id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <h3 className="font-bold text-slate-200">{u.name}</h3>
                  <span className="text-[10px] text-slate-400">Target: {u.targetExams?.join(', ') || 'SSC'}</span>
                </div>
                <button
                  onClick={() => alert(`Friend request sent to ${u.name}`)}
                  className="py-1.5 px-3 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-[10px] flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Request
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* My Friends & Challenge Action */}
        <div className="glass-panel p-5 rounded-xl border border-slate-700/80 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Swords className="w-4 h-4 text-amber-400" /> My Study Friends
          </h2>

          <div className="space-y-2.5">
            {(friends.length > 0 ? friends : [
              { _id: 'f1', name: 'Rahul Sharma', level: 6, streak: 5, targetExams: ['UP Police'] },
              { _id: 'f2', name: 'Aman Verma', level: 9, streak: 12, targetExams: ['SSC CGL'] }
            ]).map(f => (
              <div key={f._id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <h3 className="font-bold text-slate-100">{f.name}</h3>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="text-blue-400 font-semibold">Lvl {f.level}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                      <Flame className="w-3 h-3 fill-amber-400" /> {f.streak}d
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onChallengeFriend && onChallengeFriend(f)}
                  className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1"
                >
                  <Swords className="w-3.5 h-3.5" /> Challenge
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
