import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

// Smoke test for the test setup itself: if this passes, jest-expo +
// @testing-library/react-native are wired up correctly.
//
// Note: in RNTL v14 both `render` and `fireEvent` are async — always await them,
// otherwise the queries run before anything has been rendered.
describe('Button', () => {
  it('renders its title and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Opslaan" onPress={onPress} />);

    await fireEvent.press(screen.getByText('Opslaan'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress while loading', async () => {
    const onPress = jest.fn();
    await render(<Button title="Opslaan" onPress={onPress} loading />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
