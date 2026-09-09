import { Link } from 'react-router-dom';
import { Empty } from '../components/Ui';

export default function NotFound() {
  return (
    <Empty
      title="That page does not exist"
      action={
        <Link to="/" className="btn-primary">
          Go home
        </Link>
      }
    >
      Check the address, or start again from the home page.
    </Empty>
  );
}
