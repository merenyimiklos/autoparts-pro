'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
export default function AdminUsers(){const[users,setUsers]=useState<any[]>([]);useEffect(()=>{api<any[]>('/admin/operations/users').then(setUsers).catch(()=>{})},[]);return <main className="section"><div className="container"><h1>Felhasználók</h1><div style={{overflowX:'auto'}}><table><thead><tr><th>Név</th><th>E-mail</th><th>Szerepkör</th><th>Árcsoport</th><th>Megerősítve</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.lastName} {u.firstName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.customerGroup?.name??'Normál'}</td><td>{u.emailVerifiedAt?'Igen':'Nem'}</td></tr>)}</tbody></table></div></div></main>}
