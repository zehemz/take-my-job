export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <p style={{ fontSize: '3rem', fontWeight: 600, color: '#52525b', margin: '0 0 0.75rem 0' }}>
        404
      </p>
      <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Page not found.</p>
    </div>
  );
}
