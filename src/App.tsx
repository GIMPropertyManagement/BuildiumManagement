import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <Authenticator hideSignUp={false}>
      {({ signOut, user }) => (
        <Dashboard
          onSignOut={() => signOut?.()}
          userEmail={user?.signInDetails?.loginId ?? user?.username}
        />
      )}
    </Authenticator>
  );
}

export default App;
