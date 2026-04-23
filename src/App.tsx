import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Dashboard } from './components/Dashboard';
import { FinancePage } from './components/FinancePage';

type Page = 'tasks' | 'finance';

function App() {
  const [page, setPage] = useState<Page>('tasks');

  return (
    <Authenticator hideSignUp={false}>
      {({ signOut, user }) => {
        const email = user?.signInDetails?.loginId ?? user?.username;
        const onSignOut = () => signOut?.();
        if (page === 'finance') {
          return (
            <FinancePage
              onSignOut={onSignOut}
              userEmail={email}
              onNavigate={setPage}
            />
          );
        }
        return (
          <Dashboard
            onSignOut={onSignOut}
            userEmail={email}
            onNavigate={setPage}
          />
        );
      }}
    </Authenticator>
  );
}

export default App;
